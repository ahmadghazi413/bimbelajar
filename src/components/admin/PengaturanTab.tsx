import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settingsQuery } from "@/lib/queries";
import { parseBankAccounts, type BankAccount } from "@/lib/bank-accounts";
import { sb, field, safeFileName } from "./shared";
import { WaOutboxPanel } from "./WaOutboxPanel";

const KEYS = ["site_name", "admin_whatsapp", "bank_name", "bank_number", "bank_holder", "bank_accounts", "payment_mode", "logo_url", "qris_image_url", "apk_url", "apk_name"] as const;
type Form = Record<(typeof KEYS)[number], string>;
const empty = Object.fromEntries(KEYS.map((k) => [k, ""])) as Form;

export function PengaturanTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery(settingsQuery);
  const [form, setForm] = useState<Form>(empty);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [busy, setBusy] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const qrisRef = useRef<HTMLInputElement>(null);
  const apkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!settings) return;
    setForm({ ...empty, ...Object.fromEntries(KEYS.map((k) => [k, settings[k] ?? ""])) } as Form);
    setAccounts(parseBankAccounts(settings));
  }, [settings]);
  const setAcc = (i: number, k: keyof BankAccount, v: string) => setAccounts((a) => a.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save(next: Form = form) {
    setBusy(true);
    const clean = accounts
      .map((a) => ({ bank: a.bank.trim(), number: a.number.trim(), holder: a.holder.trim() }))
      .filter((a) => a.number);
    // Rekening pertama juga disalin ke kolom lama supaya tetap kompatibel.
    const payload: Form = { ...next, bank_accounts: JSON.stringify(clean), bank_name: clean[0]?.bank ?? "", bank_number: clean[0]?.number ?? "", bank_holder: clean[0]?.holder ?? "" };
    const { error } = await sb.from("settings").upsert(KEYS.map((k) => ({ key: k, value: (payload[k] ?? "").trim() })));
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pengaturan disimpan.");
    await qc.invalidateQueries({ queryKey: ["settings"] });
  }

  async function uploadPublic(file: File, folder: string, key: keyof Form, nameKey?: keyof Form) {
    const path = `${folder}/${safeFileName(file.name)}`;
    const up = await sb.storage.from("app-files").upload(path, file);
    if (up.error) return toast.error("Gagal mengunggah: " + up.error.message);
    const url = sb.storage.from("app-files").getPublicUrl(path).data.publicUrl;
    const next = { ...form, [key]: url, ...(nameKey ? { [nameKey]: file.name } : {}) } as Form;
    setForm(next);
    await save(next);
  }

  async function uploadQris(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Gunakan gambar JPG, PNG, atau WebP.");
    const path = `qris/${safeFileName(file.name)}`;
    const up = await sb.storage.from("payment-proofs").upload(path, file);
    if (up.error) return toast.error("Gagal mengunggah: " + up.error.message);
    const next = { ...form, qris_image_url: path };
    setForm(next);
    await save(next);
  }

  const pick = (ref: React.RefObject<HTMLInputElement | null>, accept: string, onFile: (f: File) => void, label: string) => (
    <>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}><Upload className="h-4 w-4" /> {label}</Button>
    </>
  );
  const txt = (k: keyof Form, label: string, hint?: string) => (
    <div className="space-y-1"><Label>{label}</Label><Input value={form[k]} onChange={(e) => set(k, e.target.value)} />{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Pengaturan</h2>
      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h3 className="font-semibold">Identitas website</h3>
        {txt("site_name", "Nama website")}
        {txt("admin_whatsapp", "Nomor WhatsApp admin", "Format 62812xxxxxxx, tanpa + atau spasi.")}
        <div className="space-y-2"><Label>Logo</Label>
          {form.logo_url && <img src={form.logo_url} alt="Logo" className="h-12 w-auto max-w-[160px] object-contain" />}
          {pick(logoRef, "image/png,image/jpeg,image/webp,image/svg+xml", (f) => void uploadPublic(f, "logo", "logo_url"), form.logo_url ? "Ganti logo" : "Unggah logo")}
        </div>
      </section>
      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h3 className="font-semibold">Pembayaran</h3>
        <div className="space-y-1"><Label>Metode pembayaran</Label>
          <select className={field} value={form.payment_mode || "manual"} onChange={(e) => set("payment_mode", e.target.value)}>
            <option value="manual">Transfer bank / QRIS saja</option><option value="both">Tambah iPaymu (otomatis) + transfer bank / QRIS</option><option value="ipaymu">iPaymu saja</option>
          </select></div>
        <div className="space-y-2"><Label>Rekening bank</Label>
          <p className="text-xs text-muted-foreground">Murid bisa memilih transfer bank atau QRIS, dan menyalin nomor rekening. Boleh lebih dari satu rekening.</p>
          {accounts.map((a, i) => (
            <div key={i} className="space-y-2 rounded-xl border p-3">
              <Input placeholder="Nama bank (mis. BCA)" value={a.bank} onChange={(e) => setAcc(i, "bank", e.target.value)} />
              <Input placeholder="Nomor rekening" inputMode="numeric" value={a.number} onChange={(e) => setAcc(i, "number", e.target.value)} />
              <Input placeholder="Atas nama" value={a.holder} onChange={(e) => setAcc(i, "holder", e.target.value)} />
              <Button type="button" variant="ghost" size="sm" onClick={() => setAccounts((x) => x.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /> Hapus rekening</Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setAccounts((x) => [...x, { bank: "", number: "", holder: "" }])}><Plus className="h-4 w-4" /> Tambah rekening</Button>
        </div>
        <div className="space-y-2"><Label>Gambar QRIS</Label>
          {form.qris_image_url ? <p className="text-xs text-muted-foreground">QRIS sudah terpasang.</p> : <p className="text-xs text-muted-foreground">Belum ada QRIS.</p>}
          {pick(qrisRef, "image/png,image/jpeg,image/webp", (f) => void uploadQris(f), form.qris_image_url ? "Ganti QRIS" : "Unggah QRIS")}
        </div>
      </section>
      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h3 className="font-semibold">Aplikasi Android</h3>
        {txt("apk_url", "Link unduh APK", "Kosongkan untuk menyembunyikan tombol “Unduh aplikasi”.")}
        {txt("apk_name", "Nama file saat diunduh", "Mis. PadatIlmu.apk")}
        {pick(apkRef, ".apk,application/vnd.android.package-archive", (f) => void uploadPublic(f, "apk", "apk_url", "apk_name"), "Unggah file APK")}
      </section>
      <Button onClick={() => save()} disabled={busy}>Simpan pengaturan</Button>
            <WaOutboxPanel />
    </div>
  );
}
