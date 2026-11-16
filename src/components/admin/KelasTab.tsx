import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Copy, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminDelete } from "@/components/AdminDelete";
import { classType, CLASS_TYPE_LABEL } from "@/lib/class-type";
import { rupiah } from "@/lib/format";
import { buildPackagePrices, getPackagePrice, monthlyChoices, packageCounts, packageLabel, parsePackagePrices, SESSION_CHOICES, startingPrice, unitWeeks, type PricePair } from "@/lib/package-prices";
import { DAYS, formatSchedule, slotsForSave, slotsOf, type Day, type ScheduleSlot } from "@/lib/schedule";
import { settingsQuery } from "@/lib/queries";
import { groupClasses, nextRombelName, splitRombelName, type ClassGroup } from "@/lib/class-groups";
import { CATEGORY_OPTIONS, categoryLabel, classCategory } from "@/lib/class-category";
import { parseTeachers } from "@/lib/teachers";
import { sb, field, slugify, useClasses, useSubjects } from "./shared";

const WEEK_OPTIONS = [{ v: 1, l: "1 minggu" }, { v: 2, l: "2 minggu" }, { v: 3, l: "3 minggu" }, { v: 4, l: "1 bulan" }];

const GENDER_FILTERS = [
  { v: "all", l: "Semua" },
  { v: "ikhwan", l: "Ikhwan" },
  { v: "akhwat", l: "Akhwat" },
  { v: "umum", l: "Umum" },
] as const;
type GenderFilter = (typeof GENDER_FILTERS)[number]["v"];
const GENDER_LABEL: Record<string, string> = { all: "Umum", ikhwan: "Ikhwan", akhwat: "Akhwat" };

type PriceDraft = { normal: number | ""; promo: number | "" };
type PriceTable = { monthly: Record<string, PriceDraft>; session: Record<string, PriceDraft> };

/** Isi awal tabel harga: pakai tabel baru, atau turunkan dari harga lama supaya kelas lama bisa langsung diedit. */
function initialPrices(c: any): PriceTable {
  const out: PriceTable = { monthly: {}, session: {} };
  for (const kind of ["monthly", "session"] as const) {
    for (const count of packageCounts(c, kind)) {
      const table = parsePackagePrices(c.package_prices)[kind]?.[String(count)];
      let pair: PricePair;
      if (table && table.normal > 0) pair = table;
      else {
        const legacy = getPackagePrice({ ...c, package_prices: {} }, kind, count);
        pair = { normal: legacy.normal, promo: legacy.promo };
      }
      out[kind][String(count)] = { normal: pair.normal || "", promo: pair.promo || "" };
    }
  }
  return out;
}

function toggle<T>(list: T[], v: T) { return list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort() as T[]; }

/** Validasi paket dan harga, lalu hasilkan kolom `classes` yang berkaitan dengan harga. */
function computePricing(e: any): { error: string } | { cols: Record<string, any> } {
  const pkgs: string[] = e.allowed_packages?.length ? e.allowed_packages : ["monthly"];
  const hasMonthly = pkgs.includes("monthly");
  const hasSession = pkgs.includes("session");
  const months: number[] = hasMonthly ? [...(e.available_months ?? [])].sort((a: number, b: number) => a - b) : [];
  const sessions: number[] = hasSession ? [...(e.available_sessions ?? [])].sort((a: number, b: number) => a - b) : [];
  if (hasMonthly && !months.length) return { error: "Pilih minimal satu lama paket." };
  if (hasSession && !sessions.length) return { error: "Pilih minimal satu jumlah sesi." };
  const prices = e.prices as PriceTable;
  for (const [kind, counts] of [["monthly", months], ["session", sessions]] as const) {
    for (const n of counts) {
      const row = prices[kind][String(n)];
      const normal = Number(row?.normal || 0);
      const promo = Number(row?.promo || 0);
      const lbl = packageLabel(kind, n, unitWeeks(e));
      if (!(normal > 0)) return { error: `Isi harga normal paket ${lbl}.` };
      if (promo > 0 && promo >= normal) return { error: `Harga promo paket ${lbl} harus lebih kecil dari harga normal.` };
    }
  }
  const table = buildPackagePrices(prices as any, months, sessions);
  const unit = (kind: "monthly" | "session", counts: number[]) => {
    const n0 = counts[0];
    if (!n0) return { normal: 0, promo: 0 };
    const p = table[kind]![String(n0)]!;
    return { normal: Math.round(p.normal / n0), promo: p.promo > 0 ? Math.round(p.promo / n0) : 0 };
  };
  const uM = unit("monthly", months);
  const uS = unit("session", sessions);
  const sessionOnly = hasSession && !hasMonthly;
  const effMonthly = uM.promo > 0 ? uM.promo : uM.normal;
  const effSession = uS.promo > 0 ? uS.promo : uS.normal;
  return {
    cols: {
      package_prices: table,
      price_normal: uM.normal,
      price_promo: uM.promo,
      price: sessionOnly ? effSession : effMonthly,
      allowed_packages: pkgs,
      available_sessions: sessions,
      available_months: months,
      price_per_session: effSession,
      price_per_session_normal: uS.normal,
      price_per_session_promo: uS.promo,
      package_type: sessionOnly ? "session" : "monthly",
      package_weeks: Number(e.package_weeks || 4),
      package_sessions: sessionOnly ? 1 : Number(sessions[0] ?? 4),
    },
  };
}

export function KelasTab() {
  const { data: classes = [] } = useClasses();
  const { data: subjects = [] } = useSubjects();
  const { data: settings } = useQuery(settingsQuery);
  const teachers = parseTeachers(settings?.["teacher_list"]);
  const qc = useQueryClient();
  const [edit, setEdit] = useState<any | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");

  const visibleClasses = classes.filter((c) => {
    if (!subjectId || c.subject_id !== subjectId) return false;
    const g = c.target_gender || "all";
    if (genderFilter === "all") return true;
    return genderFilter === "umum" ? g === "all" : g === genderFilter;
  });
  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const groups = groupClasses(visibleClasses);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const { data: counts = {} } = useQuery({
    queryKey: ["admin-class-counts"],
    queryFn: async () => {
      const { data } = await sb.rpc("get_class_enrollment_counts");
      return Object.fromEntries(((data as any[]) ?? []).map((r) => [r.class_id, Number(r.enrolled_count) || 0])) as Record<string, number>;
    },
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["admin-classes"] });
    await qc.invalidateQueries({ queryKey: ["classes"] });
    await qc.invalidateQueries({ queryKey: ["subject-classes"] });
  }

  async function open(c: any | null) {
    if (!c) {
      return setEdit({
        mode: "new",
        is_active: true, allowed_packages: ["monthly"], package_weeks: 4,
        available_months: [1], available_sessions: [],
        prices: { monthly: { "1": { normal: "", promo: "" } }, session: {} } as PriceTable,
        slots: [] as ScheduleSlot[], schedule: "",
        subject_id: subjectId || "", target_gender: genderFilter === "ikhwan" || genderFilter === "akhwat" ? genderFilter : "all",
        level_number: 1, level_label: "Pra Tahsin", quota: 15, sort_order: classes.length + 1, whatsapp_link: "", zoom_link: "",
      });
    }
    const { data } = await sb.from("class_private").select("*").eq("class_id", c.id).maybeSingle();
    const slots = slotsOf(c);
    setEdit({
      mode: "rombel",
      ...c, whatsapp_link: data?.whatsapp_link ?? "", zoom_link: data?.zoom_link ?? "",
      available_months: (() => { const ok = packageCounts(c, "monthly").filter((m) => monthlyChoices(unitWeeks(c)).includes(m)); return ok.length ? ok : [1]; })(), available_sessions: packageCounts(c, "session"),
      prices: initialPrices(c), slots, legacySchedule: slots.length ? "" : (c.schedule ?? ""),
    });
  }
  /** Rombel baru: salinan `c` dengan nama berikutnya di program yang sama (Kelas A → B → C). */
  async function addRombel(c: any, group: ClassGroup) {
    const { data } = await sb.from("class_private").select("*").eq("class_id", c.id).maybeSingle();
    const slots = slotsOf(c);
    setEdit({
      mode: "rombel",
      ...c,
      id: undefined, // Kosongkan id agar disimpan sebagai kelas baru
      slug: "",      // Kosongkan slug agar sistem membuat URL baru
      name: nextRombelName(group),
      sort_order: classes.length + 1,
      whatsapp_link: data?.whatsapp_link ?? "",
      zoom_link: data?.zoom_link ?? "",
      available_months: (() => { const ok = packageCounts(c, "monthly").filter((m) => monthlyChoices(unitWeeks(c)).includes(m)); return ok.length ? ok : [1]; })(),
      available_sessions: packageCounts(c, "session"),
      prices: initialPrices(c),
      slots,
      legacySchedule: slots.length ? "" : (c.schedule ?? ""),
    });
    toast.info("Rombel baru siap. Atur jadwal dan pengajarnya, lalu klik Simpan.");
  }

  /** Kolom yang dipakai bersama oleh semua rombel dalam satu program. */
  const SHARED_KEYS = ["subject_id", "name", "tagline", "description", "goals", "advantages", "level", "target_gender", "price_prefix"] as const;
  const sharedSnapshot = (e: any) => ({
    subject_id: e.subject_id ?? "", name: e.name ?? "", tagline: e.tagline ?? "", description: e.description ?? "", goals: e.goals ?? "",
    advantages: e.advantages ?? "", level: `${e.level_number}|${e.level_label}`, target_gender: e.target_gender ?? "all", price_prefix: e.price_prefix ?? "",
  });

  async function openProgram(group: ClassGroup) {
    const first = group.rombels[0]!;
    const base = {
      ...first,
      name: group.cleanName,
      available_months: (() => { const ok = packageCounts(first, "monthly").filter((m) => monthlyChoices(unitWeeks(first)).includes(m)); return ok.length ? ok : [1]; })(),
      available_sessions: packageCounts(first, "session"),
      prices: initialPrices(first),
    };
    setEdit({ ...base, mode: "program", group, applyPricing: false, initial: sharedSnapshot(base) });
  }

  /** Simpan perubahan program ke semua rombel. Hanya kolom yang benar-benar diubah yang ditimpa. */
  async function saveProgram() {
    const { group, initial } = edit;
    if (!String(edit.name ?? "").trim()) return toast.error("Nama program wajib diisi.");
    if (!edit.subject_id) return toast.error("Pilih ilmu.");
    const now = sharedSnapshot(edit);
    const changed = (k: (typeof SHARED_KEYS)[number]) => now[k] !== initial[k];
    let pricing: Record<string, any> | null = null;
    if (edit.applyPricing) {
      const pr = computePricing(edit);
      if ("error" in pr) return toast.error(pr.error);
      pricing = pr.cols;
    }
    try {
      for (const r of group.rombels as any[]) {
        const update: Record<string, any> = {};
        if (changed("name")) {
          const { label } = splitRombelName(r.name);
          update.name = label ? `${now.name.trim()} Kelas ${label}` : now.name.trim();
        }
        for (const k of ["subject_id", "tagline", "description", "goals", "advantages", "price_prefix", "target_gender"] as const) if (changed(k)) update[k] = now[k];
        if (changed("level")) {
          const [n, l] = now.level.split("|");
          update.level_number = Number(n); update.level_label = l; update.levels_label = l;
        }
        if (pricing) Object.assign(update, pricing);
        if (Object.keys(update).length === 0) continue;
        const { error } = await sb.from("classes").update(update).eq("id", r.id);
        if (error) throw new Error(error.message.includes("duplicate") ? "Nama program bentrok dengan kelas lain. Ganti sedikit namanya." : error.message);
      }
      await refresh();
      setEdit(null);
      toast.success(`Program diperbarui untuk ${group.rombels.length} rombel.`);
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menyimpan program.");
    }
  }

  async function save() {
    if (edit?.mode === "program") return saveProgram();
    if (!edit?.name?.trim() || !edit.subject_id) return toast.error("Nama kelas dan ilmu wajib diisi.");
    const pr = computePricing(edit);
    if ("error" in pr) return toast.error(pr.error);
    if (edit.slots?.some((x: ScheduleSlot) => x.end <= x.start)) return toast.error("Jam selesai harus setelah jam mulai.");
    const lvl = Number(edit.level_number ?? 1);
    const label = edit.level_label ?? "Pemula";
    const payload = {
      slug: edit.slug || slugify(edit.name, "kelas"),
      name: edit.name.trim(),
      tagline: edit.tagline ?? "",
      description: edit.description ?? "",
      goals: edit.goals ?? "",
      advantages: edit.advantages ?? "",
      schedule: edit.slots?.length ? formatSchedule(edit.slots) : (edit.legacySchedule ?? ""),
      quota: Number(edit.quota ?? 15),
      target_gender: edit.target_gender || "all",
      price_prefix: edit.price_prefix ?? "",
      is_active: edit.is_active ?? true,
      sort_order: Number(edit.sort_order ?? 99),
      subject_id: edit.subject_id,
      level_number: lvl,
      level_label: label,
      levels_label: label,
      schedule_slots: slotsForSave(edit.slots ?? []),
      // Pengajar utama = pengajar hari pertama; tanpa jadwal, memakai pilihan tunggal.
      teacher_id: (edit.slots?.length ? [...edit.slots].sort((a: ScheduleSlot, b: ScheduleSlot) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day)).find((x: ScheduleSlot) => x.teacherId)?.teacherId : edit.teacher_id) || null,
      ...pr.cols,
    };
    const res = edit.id
      ? await sb.from("classes").update(payload).eq("id", edit.id).select("id").single()
      : await sb.from("classes").insert(payload).select("id").single();
    if (res.error) return toast.error(res.error.message.includes("duplicate") ? "Nama kelas ini sudah ada, ganti sedikit namanya." : res.error.message);
    const priv = await sb.from("class_private").upsert({ class_id: res.data.id, whatsapp_link: edit.whatsapp_link ?? "", zoom_link: edit.zoom_link ?? "" });
    if (priv.error) return toast.error("Kelas tersimpan, tetapi link grup/Zoom gagal: " + priv.error.message);
    toast.success(edit.id ? "Kelas diperbarui." : "Kelas dibuat.");
    setEdit(null);
    await refresh();
  }

  const set = (k: string, v: any) => setEdit((e: any) => ({ ...e, [k]: v }));
  const txt = (k: string, label: string, area = false) => (
    <div className="space-y-1"><Label>{label}</Label>
      {area ? <Textarea value={edit?.[k] ?? ""} onChange={(e) => set(k, e.target.value)} /> : <Input value={edit?.[k] ?? ""} onChange={(e) => set(k, e.target.value)} />}
    </div>
  );
  const num = (k: string, label: string) => (
    <div className="space-y-1"><Label>{label}</Label><Input type="number" min={0} value={edit?.[k] ?? ""} onChange={(e) => set(k, e.target.value === "" ? "" : Number(e.target.value))} /></div>
  );
  const pk: string[] = edit?.allowed_packages ?? ["monthly"];
  const mode: "new" | "rombel" | "program" = edit?.mode ?? "new";
  const showShared = mode !== "rombel";
  const showRombel = mode !== "program";
  const showPricing = mode !== "program" || !!edit?.applyPricing;
  const setPrice = (kind: "monthly" | "session", count: number, f: "normal" | "promo", v: number | "") =>
    setEdit((e: any) => ({ ...e, prices: { ...e.prices, [kind]: { ...e.prices[kind], [String(count)]: { ...(e.prices[kind][String(count)] ?? { normal: "", promo: "" }), [f]: v } } } }));
  const toggleCount = (kind: "monthly" | "session", count: number) =>
    setEdit((e: any) => {
      const key = kind === "monthly" ? "available_months" : "available_sessions";
      const on = (e[key] ?? []).includes(count);
      const prices = { ...e.prices, [kind]: { ...e.prices[kind] } };
      if (!on && !prices[kind][String(count)]) prices[kind][String(count)] = { normal: "", promo: "" };
      return { ...e, [key]: toggle(e[key] ?? [], count), prices };
    });
  const setSlots = (slots: ScheduleSlot[]) => setEdit((e: any) => ({ ...e, slots, schedule: formatSchedule(slots) }));
  const toggleDay = (day: Day) => {
    const slots: ScheduleSlot[] = edit?.slots ?? [];
    const defaultTeacher = slots.find((x) => x.teacherId)?.teacherId ?? (edit?.teacher_id || undefined);
    setSlots(slots.some((x) => x.day === day) ? slots.filter((x) => x.day !== day) : [...slots, { day, start: "19:30", end: "21:00", teacherId: defaultTeacher }]);
  };
  const setSlotTeacher = (day: Day, teacherId: string) =>
    setSlots((edit?.slots ?? []).map((x: ScheduleSlot) => (x.day === day ? { ...x, teacherId: teacherId || undefined } : x)));
  const setSlotTime = (day: Day, f: "start" | "end", v: string) =>
    setSlots((edit?.slots ?? []).map((x: ScheduleSlot) => (x.day === day ? { ...x, [f]: v } : x)));
  const weeks = unitWeeks(edit);
  const setWeeks = (w: number) =>
    setEdit((e: any) => {
      const allowed = monthlyChoices(w);
      const kept = (e.available_months ?? []).filter((m: number) => allowed.includes(m));
      const months = kept.length ? kept : [1];
      const prices = { ...e.prices, monthly: { ...e.prices.monthly } };
      for (const m of months) if (!prices.monthly[String(m)]) prices.monthly[String(m)] = { normal: "", promo: "" };
      return { ...e, package_weeks: w, available_months: months, prices };
    });
  const priceRow = (kind: "monthly" | "session", count: number) => {
    const row = edit?.prices?.[kind]?.[String(count)] ?? { normal: "", promo: "" };
    return (
      <div key={`${kind}-${count}`} className="grid items-end gap-2 rounded-xl bg-secondary/40 p-3 sm:grid-cols-[6rem_1fr_1fr]">
        <p className="text-sm font-semibold">{packageLabel(kind, count, weeks)}</p>
        <div className="space-y-1"><Label className="text-xs">Harga normal (Rp)</Label>
          <Input type="number" min={0} value={row.normal} onChange={(e) => setPrice(kind, count, "normal", e.target.value === "" ? "" : Number(e.target.value))} /></div>
        <div className="space-y-1"><Label className="text-xs">Harga promo (Rp, kosong = tanpa promo)</Label>
          <Input type="number" min={0} value={row.promo} onChange={(e) => setPrice(kind, count, "promo", e.target.value === "" ? "" : Number(e.target.value))} /></div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Kelola Kelas</h2>
        <Button onClick={() => open(null)}>Tambah kelas</Button>
      </div>

      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="space-y-1">
          <Label>Pilih ilmu</Label>
          <select className={field} value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setGenderFilter("all"); }}>
            <option value="">Pilih ilmu terlebih dahulu</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {subjectId && (
          <div className="space-y-1">
            <Label>Kelompok</Label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter kelompok">
              {GENDER_FILTERS.map((g) => (
                <button key={g.v} type="button" aria-pressed={genderFilter === g.v} onClick={() => setGenderFilter(g.v)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${genderFilter === g.v ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-secondary"}`}>
                  {g.l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!subjectId && <p className="text-muted-foreground">Pilih ilmu di atas untuk melihat dan mengelola kelasnya.</p>}
      {subjectId && visibleClasses.length === 0 && (
        <p className="text-muted-foreground">Belum ada kelas {genderFilter === "all" ? "" : `${GENDER_FILTERS.find((g) => g.v === genderFilter)?.l} `}di {selectedSubject?.name}.</p>
      )}
      {subjectId && groups.length > 0 && (
        <p className="text-sm text-muted-foreground">{groups.length} program · {visibleClasses.length} kelas/rombel</p>
      )}
      {groups.map((g) => {
        const first = g.rombels[0]!;
        const prices = g.rombels.map((r) => startingPrice(r)).filter(Boolean) as NonNullable<ReturnType<typeof startingPrice>>[];
        const low = prices.length ? prices.reduce((a, b) => (b.final < a.final ? b : a)) : null;
        const expanded = openGroups[g.key] ?? g.rombels.length <= 3;
        const gender = first.target_gender || "all";
        const activeCount = g.rombels.filter((r) => r.is_active).length;
        return (
          <section key={g.key} className="overflow-hidden rounded-3xl border bg-card shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-primary via-primary/70 to-primary/20" />
            <div className="space-y-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold leading-snug text-primary">{g.cleanName}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">{categoryLabel(first)}</span>
                    <span className={`rounded-full px-2.5 py-1 ${gender === "akhwat" ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : gender === "ikhwan" ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200" : "bg-secondary text-secondary-foreground"}`}>{GENDER_LABEL[gender]}</span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{g.rombels.length} rombel{activeCount < g.rombels.length ? ` · ${activeCount} aktif` : ""}</span>
                  </div>
                  {low && (
                    <p className="mt-2 text-sm">
                      <span className="mr-1 text-muted-foreground">Mulai</span>
                      {low.hasPromo && <span className="mr-2 text-muted-foreground line-through">{rupiah(low.normal)}</span>}
                      <span className="font-semibold">{rupiah(low.final)}</span> <span className="text-muted-foreground">/ {low.label}</span>
                      {prices.some((p) => p.final !== low.final) && <span className="ml-2 text-xs text-muted-foreground">(harga tiap rombel bisa berbeda)</span>}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => openProgram(g)}><Pencil className="mr-1.5 h-4 w-4" />Ubah program</Button>
                  <Button size="sm" className="rounded-xl" onClick={() => addRombel(g.rombels[g.rombels.length - 1]!, g)}><Plus className="mr-1.5 h-4 w-4" />Tambah rombel</Button>
                </div>
              </div>

              {g.rombels.length > 3 && (
                <button type="button" className="flex items-center gap-1 text-sm font-medium text-primary" aria-expanded={expanded} onClick={() => setOpenGroups((o) => ({ ...o, [g.key]: !expanded }))}>
                  <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                  {expanded ? "Sembunyikan rombel" : `Tampilkan ${g.rombels.length} rombel`}
                </button>
              )}

              {expanded && (
                <ul className="divide-y rounded-2xl border bg-background/60">
                  {g.rombels.map((c) => {
                    const start = startingPrice(c);
                    const { label } = splitRombelName(c.name);
                    const filled = counts[c.id] ?? 0;
                    return (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-semibold">
                            {label ? `Kelas ${label}` : c.name}
                            {!c.is_active && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">nonaktif</span>}
                          </p>
                          {slotsOf(c).length > 0 ? (
                            <ul className="text-sm text-muted-foreground">
                              {slotsOf(c).map((sl) => (
                                <li key={sl.day}>{sl.day} {sl.start}–{sl.end} WIB · <span className="text-foreground">{teachers.find((t) => t.id === sl.teacherId)?.name ?? "belum ada pengajar"}</span></li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">{c.schedule || "Jadwal belum ditentukan"}</p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {CLASS_TYPE_LABEL[classType(c)]} · {filled}/{c.quota || 15} terisi
                            {start && <> · <span className="text-foreground">{rupiah(start.final)}</span> / {start.label}</>}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button variant="outline" size="icon" aria-label={`Duplikat ${c.name}`} title="Duplikat sebagai rombel baru" onClick={() => addRombel(c, g)}><Copy className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" aria-label={`Ubah ${c.name}`} onClick={() => open(c)}><Pencil className="h-4 w-4" /></Button>
                          <AdminDelete name={c.name} description="Kelas kosong beserta sesi dan rekamannya dihapus permanen. Kelas yang sudah punya pendaftar tidak bisa dihapus, nonaktifkan saja."
                            onDelete={async () => { const { error } = await sb.from("classes").delete().eq("id", c.id); if (error) throw new Error(error.message); await refresh(); }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        );
      })}

      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle>{edit.mode === "program" ? "Ubah program" : edit.mode === "rombel" ? (edit.id ? "Ubah rombel" : "Rombel baru") : "Tambah kelas"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {mode === "program" && (
                <p className="rounded-xl bg-primary/10 p-3 text-sm text-primary">
                  <strong>Berlaku untuk {edit.group.rombels.length} rombel.</strong> Jadwal, pengajar, kuota, dan link diatur per rombel lewat tombol edit di barisnya.
                </p>
              )}
              {mode === "rombel" && (
                <p className="rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">
                  Program: <strong className="text-foreground">{splitRombelName(edit.name).base}</strong> · {categoryLabel(edit)} · {GENDER_LABEL[edit.target_gender || "all"]}.
                  {" "}Nama program, deskripsi, kategori, dan kelompok diubah lewat <strong>Ubah program</strong>.
                </p>
              )}

              {showShared && (
                <div className="space-y-1"><Label>Ilmu</Label>
                  <select className={field} value={edit.subject_id ?? ""} onChange={(e) => set("subject_id", e.target.value)}>
                    <option value="">Pilih ilmu</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></div>
              )}
              {txt("name", mode === "program" ? "Nama program (huruf rombel dipertahankan otomatis)" : mode === "rombel" ? "Nama rombel (mis. Tahsin Kelas A)" : "Nama kelas")}
              {showShared && (<>
                {txt("tagline", "Tagline")}
                {txt("description", "Deskripsi", true)}
                {txt("goals", "Tujuan", true)}
                {txt("advantages", "Keunggulan (satu per baris)", true)}
                <div className="space-y-1"><Label>Kategori</Label>
                  <select className={field} value={classCategory(edit)}
                    onChange={(e) => { const o = CATEGORY_OPTIONS.find((x) => x.value === e.target.value)!; setEdit((x: any) => ({ ...x, level_number: o.levelNumber, level_label: o.label })); }}>
                    {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select></div>
                <div className="space-y-1"><Label>Untuk</Label>
                  <select className={field} value={edit.target_gender ?? "all"} onChange={(e) => set("target_gender", e.target.value)}>
                    <option value="all">Umum</option><option value="ikhwan">Ikhwan</option><option value="akhwat">Akhwat</option>
                  </select></div>
                {txt("price_prefix", "Awalan harga (mis. Mulai)")}
              </>)}

              {showRombel && (<>
              <div className="space-y-2">
                <Label>Jadwal (pilih hari dan jam)</Label>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih hari">
                  {DAYS.map((d) => {
                    const on = (edit.slots ?? []).some((x: ScheduleSlot) => x.day === d);
                    return (
                      <button key={d} type="button" aria-pressed={on} onClick={() => toggleDay(d)}
                        className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-secondary"}`}>
                        {d}
                      </button>
                    );
                  })}
                </div>
                {(edit.slots ?? []).length === 0 && edit.legacySchedule && (
                  <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Jadwal lama: “{edit.legacySchedule}”. Pilih hari di atas untuk menggantinya; kalau dibiarkan, jadwal lama tetap dipakai.</p>
                )}
                {[...(edit.slots ?? [])].sort((a: ScheduleSlot, b: ScheduleSlot) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day)).map((x: ScheduleSlot) => (
                  <div key={x.day} className="space-y-2 rounded-xl bg-secondary/40 p-2.5">
                    <div className="grid grid-cols-[5rem_1fr_1fr] items-center gap-2">
                      <span className="text-sm font-semibold">{x.day}</span>
                      <div className="flex items-center gap-1.5"><span className="text-xs text-muted-foreground">Mulai</span><Input type="time" value={x.start} onChange={(e) => setSlotTime(x.day, "start", e.target.value)} /></div>
                      <div className="flex items-center gap-1.5"><span className="text-xs text-muted-foreground">Selesai</span><Input type="time" value={x.end} onChange={(e) => setSlotTime(x.day, "end", e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-[5rem_1fr] items-center gap-2">
                      <span className="text-xs text-muted-foreground">Pengajar</span>
                      <select className={field} aria-label={`Pengajar hari ${x.day}`} value={x.teacherId ?? ""} onChange={(e) => setSlotTeacher(x.day, e.target.value)}>
                        <option value="">Belum dipilih</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                {(edit.slots ?? []).length > 0 && <p className="text-xs text-muted-foreground">Tampil di website: {formatSchedule(edit.slots)}</p>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {num("quota", "Kuota")}{num("sort_order", "Urutan")}
              </div>
              {(edit.slots ?? []).length === 0 && (
                <div className="space-y-1"><Label>Pengajar (pilih hari dulu untuk mengatur pengajar per hari)</Label>
                  <select className={field} value={edit.teacher_id ?? ""} onChange={(e) => set("teacher_id", e.target.value)}>
                    <option value="">Belum dipilih</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select></div>
              )}
              {txt("whatsapp_link", "Link grup WhatsApp (untuk murid lunas)")}
              {txt("zoom_link", "Link Zoom kelas (cadangan bila sesi belum punya link sendiri)")}
              </>)}

              {mode === "program" && (
                <div className="flex items-start justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <Label>Samakan paket dan harga di semua rombel</Label>
                    <p className="text-xs text-muted-foreground">Mati: harga tiap rombel dibiarkan seperti sekarang. Hidup: paket dan harga di bawah menimpa semua rombel.</p>
                  </div>
                  <Switch checked={!!edit.applyPricing} onCheckedChange={(v) => set("applyPricing", v)} />
                </div>
              )}
              {showPricing && (<>
              <div className="space-y-2 border-t pt-3">
                <Label className="font-medium">Paket yang dijual</Label>
                <div className="flex flex-wrap gap-4">
                  {[["monthly", "Bulanan"], ["session", "Per sesi"]].map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2 text-sm"><Checkbox checked={pk.includes(v!)} onCheckedChange={() => set("allowed_packages", toggle(pk, v!))} />{l}</label>
                  ))}
                </div>
              </div>

              {pk.includes("monthly") && (
                <div className="space-y-3 border-t pt-3">
                  <div className="space-y-1">
                    <Label className="font-medium">Paket berlangganan: pilih satuan, lama, lalu isi harga tiap paket</Label>
                    <p className="text-xs text-muted-foreground">Harga setiap paket diisi sendiri, tidak otomatis kelipatan.</p>
                    <div className="space-y-1 pt-1"><Label className="text-xs">Satuan paket</Label>
                      <select className={field} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                        {WEEK_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select></div>
                    <div className="flex flex-wrap gap-4 pt-1">{monthlyChoices(weeks).map((m) => (
                      <label key={m} className="flex items-center gap-2 text-sm"><Checkbox checked={(edit.available_months ?? []).includes(m)} onCheckedChange={() => toggleCount("monthly", m)} />{packageLabel("monthly", m, weeks)}</label>
                    ))}</div>
                  </div>
                  {[...(edit.available_months ?? [])].sort((a: number, b: number) => a - b).map((m: number) => priceRow("monthly", m))}
                </div>
              )}

              {pk.includes("session") && (
                <div className="space-y-3 border-t pt-3">
                  <div className="space-y-1">
                    <Label className="font-medium">Paket per sesi: pilih jumlah sesi, lalu isi harga tiap paket</Label>
                    <div className="grid grid-cols-6 gap-2 pt-1 sm:grid-cols-10">{SESSION_CHOICES.map((n) => (
                      <label key={n} className="flex items-center gap-1 text-sm"><Checkbox checked={(edit.available_sessions ?? []).includes(n)} onCheckedChange={() => toggleCount("session", n)} />{n}</label>
                    ))}</div>
                  </div>
                  {[...(edit.available_sessions ?? [])].sort((a: number, b: number) => a - b).map((n: number) => priceRow("session", n))}
                </div>
              )}

              </>)}

              {showRombel && (
                <div className="flex items-center justify-between border-t pt-3"><Label>Kelas aktif (tampil di website)</Label><Switch checked={edit.is_active ?? true} onCheckedChange={(v) => set("is_active", v)} /></div>
              )}
              <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setEdit(null)}>Batal</Button><Button onClick={save}>{mode === "program" ? "Simpan untuk semua rombel" : "Simpan"}</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
