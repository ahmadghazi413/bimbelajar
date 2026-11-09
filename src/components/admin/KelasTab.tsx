import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Pencil } from "lucide-react";
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
import { DAYS, formatSchedule, parseSchedule, type Day, type ScheduleSlot } from "@/lib/schedule";
import { settingsQuery } from "@/lib/queries";
import { parseTeachers } from "@/lib/teachers";
import { sb, field, slugify, useClasses, useSubjects } from "./shared";

const WEEK_OPTIONS = [{ v: 1, l: "1 minggu" }, { v: 2, l: "2 minggu" }, { v: 3, l: "3 minggu" }, { v: 4, l: "1 bulan" }];

const LEVELS = [
  { n: 1, l: "Pemula" },
  { n: 2, l: "Umum" },
  { n: 3, l: "Lanjutan" },
];
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

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["admin-classes"] });
    await qc.invalidateQueries({ queryKey: ["classes"] });
    await qc.invalidateQueries({ queryKey: ["subject-classes"] });
  }

  async function open(c: any | null) {
    if (!c) {
      return setEdit({
        is_active: true, allowed_packages: ["monthly"], package_weeks: 4,
        available_months: [1], available_sessions: [],
        prices: { monthly: { "1": { normal: "", promo: "" } }, session: {} } as PriceTable,
        slots: [] as ScheduleSlot[], schedule: "",
        subject_id: subjectId || "", target_gender: genderFilter === "ikhwan" || genderFilter === "akhwat" ? genderFilter : "all",
        level_number: 1, level_label: "Pemula", quota: 15, sort_order: classes.length + 1, whatsapp_link: "", zoom_link: "",
      });
    }
    const { data } = await sb.from("class_private").select("*").eq("class_id", c.id).maybeSingle();
    const slots = parseSchedule(c.schedule);
    setEdit({
      ...c, whatsapp_link: data?.whatsapp_link ?? "", zoom_link: data?.zoom_link ?? "",
      available_months: (() => { const ok = packageCounts(c, "monthly").filter((m) => monthlyChoices(unitWeeks(c)).includes(m)); return ok.length ? ok : [1]; })(), available_sessions: packageCounts(c, "session"),
      prices: initialPrices(c), slots, legacySchedule: slots.length ? "" : (c.schedule ?? ""),
    });
  }
  async function duplicate(c: any) {
    const { data } = await sb.from("class_private").select("*").eq("class_id", c.id).maybeSingle();
    const slots = parseSchedule(c.schedule);
    setEdit({
      ...c,
      id: undefined, // Kosongkan id agar disimpan sebagai kelas baru
      slug: "",      // Kosongkan slug agar sistem membuat URL baru
      name: `${c.name} (Rombel Baru)`,
      sort_order: classes.length + 1,
      whatsapp_link: data?.whatsapp_link ?? "",
      zoom_link: data?.zoom_link ?? "",
      available_months: (() => { const ok = packageCounts(c, "monthly").filter((m) => monthlyChoices(unitWeeks(c)).includes(m)); return ok.length ? ok : [1]; })(),
      available_sessions: packageCounts(c, "session"),
      prices: initialPrices(c),
      slots,
      legacySchedule: slots.length ? "" : (c.schedule ?? ""),
    });
  }

    async function save() {
    if (!edit?.name?.trim() || !edit.subject_id) return toast.error("Nama kelas dan ilmu wajib diisi.");
    const pkgs: string[] = edit.allowed_packages?.length ? edit.allowed_packages : ["monthly"];
    const hasMonthly = pkgs.includes("monthly");
    const hasSession = pkgs.includes("session");
    const months: number[] = hasMonthly ? [...(edit.available_months ?? [])].sort((a: number, b: number) => a - b) : [];
    const sessions: number[] = hasSession ? [...(edit.available_sessions ?? [])].sort((a: number, b: number) => a - b) : [];
    if (hasMonthly && !months.length) return toast.error("Pilih minimal satu lama paket.");
    if (hasSession && !sessions.length) return toast.error("Pilih minimal satu jumlah sesi.");
    const prices = edit.prices as PriceTable;
    const check = (kind: "monthly" | "session", counts: number[]) => {
      for (const n of counts) {
        const row = prices[kind][String(n)];
        const normal = Number(row?.normal || 0);
        const promo = Number(row?.promo || 0);
        if (!(normal > 0)) return `Isi harga normal paket ${packageLabel(kind, n, unitWeeks(edit))}.`;
        if (promo > 0 && promo >= normal) return `Harga promo paket ${packageLabel(kind, n, unitWeeks(edit))} harus lebih kecil dari harga normal.`;
      }
      return null;
    };
    const problem = check("monthly", months) ?? check("session", sessions);
    if (problem) return toast.error(problem);
    if (edit.slots?.some((x: ScheduleSlot) => x.end <= x.start)) return toast.error("Jam selesai harus setelah jam mulai.");
    const table = buildPackagePrices(prices as any, months, sessions);
    const unit = (kind: "monthly" | "session", counts: number[]) => {
      const n0 = counts[0];
      if (!n0) return { normal: 0, promo: 0 };
      const p = table[kind]![String(n0)]!;
      return { normal: Math.round(p.normal / n0), promo: p.promo > 0 ? Math.round(p.promo / n0) : 0 };
    };
    const uM = unit("monthly", months);
    const uS = unit("session", sessions);
    const normalM = uM.normal, promoM = uM.promo, normalS = uS.normal, promoS = uS.promo;

    const sessionOnly = hasSession && !hasMonthly;
    const effMonthly = promoM > 0 ? promoM : normalM;
    const effSession = promoS > 0 ? promoS : normalS;
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
      package_prices: table,
      quota: Number(edit.quota ?? 15),
      target_gender: edit.target_gender || "all",
      price_normal: normalM,
      price_promo: promoM,
      price: sessionOnly ? effSession : effMonthly,
      price_prefix: edit.price_prefix ?? "",
      is_active: edit.is_active ?? true,
      allowed_packages: pkgs,
      available_sessions: sessions,
      available_months: months,
      price_per_session: effSession,
      price_per_session_normal: normalS,
      price_per_session_promo: promoS,
      package_type: sessionOnly ? "session" : "monthly",
      package_weeks: Number(edit.package_weeks || 4),
      package_sessions: sessionOnly ? 1 : Number(sessions[0] ?? 4),
      sort_order: Number(edit.sort_order ?? 99),
      subject_id: edit.subject_id,
      level_number: lvl,
      level_label: label,
      levels_label: `Level ${lvl} · ${label}`,
      teacher_id: edit.teacher_id || null,
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
    setSlots(slots.some((x) => x.day === day) ? slots.filter((x) => x.day !== day) : [...slots, { day, start: "19:30", end: "21:00" }]);
  };
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
  const levelKnown = LEVELS.some((l) => l.n === Number(edit?.level_number) && l.l === edit?.level_label);
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
      {visibleClasses.map((c) => {
        const start = startingPrice(c);
        return (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
            <div className="min-w-0">
              <p className="font-semibold">{c.name} {!c.is_active && <span className="text-xs text-muted-foreground">(nonaktif)</span>}</p>
              <p className="text-sm text-muted-foreground">{GENDER_LABEL[c.target_gender || "all"]} · Level {c.level_number} {c.level_label} · {CLASS_TYPE_LABEL[classType(c)]}</p>
              {c.schedule && <p className="text-sm text-muted-foreground">{c.schedule}</p>}
              {start && (
                <p className="text-sm">
                  <span className="mr-1 text-muted-foreground">Mulai</span>
                  {start.hasPromo && <span className="mr-2 text-muted-foreground line-through">{rupiah(start.normal)}</span>}
                  {rupiah(start.final)} <span className="text-muted-foreground">/ {start.label}</span>
                </p>
              )}
            </div>
                        <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="icon" aria-label={`Duplikat ${c.name}`} title="Duplikat kelas (rombel baru)" onClick={() => duplicate(c)}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" aria-label={`Ubah ${c.name}`} onClick={() => open(c)}><Pencil className="h-4 w-4" /></Button>
              <AdminDelete name={c.name} description="Kelas kosong beserta sesi dan rekamannya dihapus permanen. Kelas yang sudah punya pendaftar tidak bisa dihapus, nonaktifkan saja."
                onDelete={async () => { const { error } = await sb.from("classes").delete().eq("id", c.id); if (error) throw new Error(error.message); await refresh(); }} />
            </div>
          </div>
        );
      })}

      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle>{edit.id ? "Ubah kelas" : "Tambah kelas"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Ilmu</Label>
                <select className={field} value={edit.subject_id ?? ""} onChange={(e) => set("subject_id", e.target.value)}>
                  <option value="">Pilih ilmu</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
              {txt("name", "Nama kelas")}
              {txt("tagline", "Tagline")}
              {txt("description", "Deskripsi", true)}
              {txt("goals", "Tujuan", true)}
              {txt("advantages", "Keunggulan (satu per baris)", true)}
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
                  <div key={x.day} className="grid grid-cols-[5rem_1fr_1fr] items-center gap-2 rounded-xl bg-secondary/40 p-2.5">
                    <span className="text-sm font-semibold">{x.day}</span>
                    <div className="flex items-center gap-1.5"><span className="text-xs text-muted-foreground">Mulai</span><Input type="time" value={x.start} onChange={(e) => setSlotTime(x.day, "start", e.target.value)} /></div>
                    <div className="flex items-center gap-1.5"><span className="text-xs text-muted-foreground">Selesai</span><Input type="time" value={x.end} onChange={(e) => setSlotTime(x.day, "end", e.target.value)} /></div>
                  </div>
                ))}
                {(edit.slots ?? []).length > 0 && <p className="text-xs text-muted-foreground">Tampil di website: {formatSchedule(edit.slots)}</p>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {num("quota", "Kuota")}{num("sort_order", "Urutan")}
              </div>
              <div className="space-y-1"><Label>Level</Label>
                <select className={field} value={`${edit.level_number}|${edit.level_label}`}
                  onChange={(e) => { const [n, l] = e.target.value.split("|"); setEdit((x: any) => ({ ...x, level_number: Number(n), level_label: l })); }}>
                  {!levelKnown && <option value={`${edit.level_number}|${edit.level_label}`}>Level {edit.level_number} {edit.level_label} (lama)</option>}
                  {LEVELS.map((l) => <option key={l.n} value={`${l.n}|${l.l}`}>Level {l.n} · {l.l}</option>)}
                </select></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Untuk</Label>
                  <select className={field} value={edit.target_gender ?? "all"} onChange={(e) => set("target_gender", e.target.value)}>
                    <option value="all">Umum</option><option value="ikhwan">Ikhwan</option><option value="akhwat">Akhwat</option>
                  </select></div>
                <div className="space-y-1"><Label>Pengajar</Label>
                  <select className={field} value={edit.teacher_id ?? ""} onChange={(e) => set("teacher_id", e.target.value)}>
                    <option value="">Belum dipilih</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select></div>
              </div>
              {txt("price_prefix", "Awalan harga (mis. Mulai)")}
              {txt("whatsapp_link", "Link grup WhatsApp (untuk murid lunas)")}
              {txt("zoom_link", "Link Zoom kelas (cadangan bila sesi belum punya link sendiri)")}

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

              <div className="flex items-center justify-between border-t pt-3"><Label>Kelas aktif (tampil di website)</Label><Switch checked={edit.is_active ?? true} onCheckedChange={(v) => set("is_active", v)} /></div>
              <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setEdit(null)}>Batal</Button><Button onClick={save}>Simpan</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
