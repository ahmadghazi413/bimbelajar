import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
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
import { settingsQuery } from "@/lib/queries";
import { parseTeachers } from "@/lib/teachers";
import { sb, field, slugify, useClasses, useSubjects } from "./shared";

const WEEK_OPTIONS = [{ v: 1, l: "1 minggu" }, { v: 2, l: "2 minggu" }, { v: 3, l: "3 minggu" }, { v: 4, l: "1 bulan" }];
const MONTH_OPTIONS = [1, 2, 3, 6, 12];
const SESSION_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1);

function toggle<T>(list: T[], v: T) { return list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort() as T[]; }

export function KelasTab() {
  const { data: classes = [] } = useClasses();
  const { data: subjects = [] } = useSubjects();
  const { data: settings } = useQuery(settingsQuery);
  const teachers = parseTeachers(settings?.["teacher_list"]);
  const qc = useQueryClient();
  const [edit, setEdit] = useState<any | null>(null);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["admin-classes"] });
    await qc.invalidateQueries({ queryKey: ["classes"] });
    await qc.invalidateQueries({ queryKey: ["subject-classes"] });
  }

  async function open(c: any | null) {
    if (!c) return setEdit({ is_active: true, allowed_packages: ["monthly"], package_weeks: 4, available_months: [1, 2, 3], available_sessions: [4, 8], target_gender: "all", level_number: 1, level_label: "Pemula (Dari Nol)", quota: 15, sort_order: classes.length + 1, whatsapp_link: "", zoom_link: "" });
    const { data } = await sb.from("class_private").select("*").eq("class_id", c.id).maybeSingle();
    setEdit({ ...c, whatsapp_link: data?.whatsapp_link ?? "", zoom_link: data?.zoom_link ?? "" });
  }

  async function save() {
    if (!edit?.name?.trim() || !edit.subject_id) return toast.error("Nama kelas dan ilmu wajib diisi.");
    const pkgs: string[] = edit.allowed_packages?.length ? edit.allowed_packages : ["monthly"];
    const hasMonthly = pkgs.includes("monthly");
    const hasSession = pkgs.includes("session");
    const normalM = Number(edit.price_normal ?? 0);
    const promoM = Number(edit.price_promo ?? 0);
    const normalS = Number(edit.price_per_session_normal ?? 0);
    const promoS = Number(edit.price_per_session_promo ?? 0);
    if (hasMonthly && !(normalM > 0)) return toast.error("Isi harga normal paket bulanan.");
    if (hasSession && !(normalS > 0)) return toast.error("Isi harga normal per sesi.");
    if (promoM > 0 && promoM >= normalM) return toast.error("Harga promo bulanan harus lebih kecil dari harga normal.");
    if (promoS > 0 && promoS >= normalS) return toast.error("Harga promo per sesi harus lebih kecil dari harga normal.");
    if (hasSession && !(edit.available_sessions?.length)) return toast.error("Pilih minimal satu jumlah sesi.");
    if (hasMonthly && !(edit.available_months?.length)) return toast.error("Pilih minimal satu lama paket bulanan.");

    const sessionOnly = hasSession && !hasMonthly;
    // Kolom price/price_per_session dipakai database untuk menghitung tagihan, jadi harus berisi harga yang berlaku (promo bila ada).
    const effMonthly = promoM > 0 ? promoM : normalM;
    const effSession = promoS > 0 ? promoS : normalS;
    const lvl = Number(edit.level_number ?? 1);
    const label = edit.level_label ?? "Pemula (Dari Nol)";
    const payload = {
      slug: edit.slug || slugify(edit.name, "kelas"),
      name: edit.name.trim(),
      tagline: edit.tagline ?? "",
      description: edit.description ?? "",
      goals: edit.goals ?? "",
      advantages: edit.advantages ?? "",
      schedule: edit.schedule ?? "",
      quota: Number(edit.quota ?? 15),
      target_gender: edit.target_gender || "all",
      price_normal: normalM,
      price_promo: promoM,
      price: sessionOnly ? effSession : effMonthly,
      price_prefix: edit.price_prefix ?? "",
      is_active: edit.is_active ?? true,
      allowed_packages: pkgs,
      available_sessions: edit.available_sessions ?? [],
      available_months: edit.available_months ?? [],
      price_per_session: effSession,
      price_per_session_normal: normalS,
      price_per_session_promo: promoS,
      package_type: sessionOnly ? "session" : "monthly",
      package_weeks: Number(edit.package_weeks || 4),
      package_sessions: sessionOnly ? 1 : Number(edit.available_sessions?.[0] ?? 4),
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Kelola Kelas</h2>
        <Button onClick={() => open(null)}>Tambah kelas</Button>
      </div>
      {classes.length === 0 && <p className="text-muted-foreground">Belum ada kelas.</p>}
      {classes.map((c) => {
        const promo = Number(c.price_promo) > 0 && Number(c.price_promo) < Number(c.price_normal);
        return (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
            <div className="min-w-0">
              <p className="font-semibold">{c.name} {!c.is_active && <span className="text-xs text-muted-foreground">(nonaktif)</span>}</p>
              <p className="text-sm text-muted-foreground">{subjects.find((s) => s.id === c.subject_id)?.name ?? "Tanpa ilmu"} · Level {c.level_number} · {CLASS_TYPE_LABEL[classType(c)]}</p>
              <p className="text-sm">{promo && <span className="mr-2 text-muted-foreground line-through">{rupiah(c.price_normal)}</span>}{rupiah(promo ? c.price_promo : c.price_normal || c.price)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
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
              {txt("schedule", "Jadwal")}
              <div className="grid gap-3 sm:grid-cols-3">
                {num("quota", "Kuota")}{num("level_number", "Level ke-")}{num("sort_order", "Urutan")}
              </div>
              {txt("level_label", "Nama level (mis. Pemula)")}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Untuk</Label>
                  <select className={field} value={edit.target_gender ?? "all"} onChange={(e) => set("target_gender", e.target.value)}>
                    <option value="all">Semua</option><option value="ikhwan">Ikhwan</option><option value="akhwat">Akhwat</option>
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    {num("price_normal", "Harga normal bulanan (Rp)")}{num("price_promo", "Harga promo bulanan (Rp, kosong = tanpa promo)")}
                  </div>
                  <div className="space-y-1"><Label>Satuan paket</Label>
                    <select className={field} value={edit.package_weeks ?? 4} onChange={(e) => set("package_weeks", Number(e.target.value))}>
                      {WEEK_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select></div>
                  <div className="space-y-1"><Label>Pilihan lama paket untuk murid (bulan)</Label>
                    <div className="flex flex-wrap gap-4">{MONTH_OPTIONS.map((m) => (
                      <label key={m} className="flex items-center gap-2 text-sm"><Checkbox checked={(edit.available_months ?? []).includes(m)} onCheckedChange={() => set("available_months", toggle(edit.available_months ?? [], m))} />{m}</label>
                    ))}</div></div>
                </div>
              )}

              {pk.includes("session") && (
                <div className="space-y-3 border-t pt-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {num("price_per_session_normal", "Harga normal per sesi (Rp)")}{num("price_per_session_promo", "Harga promo per sesi (Rp, kosong = tanpa promo)")}
                  </div>
                  <div className="space-y-1"><Label>Pilihan jumlah sesi untuk murid</Label>
                    <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">{SESSION_OPTIONS.map((n) => (
                      <label key={n} className="flex items-center gap-1 text-sm"><Checkbox checked={(edit.available_sessions ?? []).includes(n)} onCheckedChange={() => set("available_sessions", toggle(edit.available_sessions ?? [], n))} />{n}</label>
                    ))}</div></div>
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
