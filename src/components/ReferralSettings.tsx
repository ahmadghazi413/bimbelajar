import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { defaultReferralConfig, referralConfigSchema, referralSettingsQuery } from "@/lib/referral";
import { rupiah, tanggal } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function ReferralSettings() {
  const qc = useQueryClient();
  const config = useQuery(referralSettingsQuery);
  const [form, setForm] = useState(defaultReferralConfig);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (config.data) setForm(config.data); }, [config.data]);
  const activity = useQuery({
    queryKey: ["admin-referrals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("id, user_id, referrer_id, referral_code, referral_reward_amount, status, created_at").not("referrer_id", "is", null).order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((data ?? []).flatMap((r) => r.referrer_id ? [r.user_id, r.referrer_id] : [r.user_id]))];
      const profiles = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      return (data ?? []).map((r) => ({ ...r, member: profiles.data?.find((p) => p.id === r.user_id)?.full_name, inviter: profiles.data?.find((p) => p.id === r.referrer_id)?.full_name }));
    },
  });
  async function save() {
    const parsed = referralConfigSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Nilai tidak valid."); return; }
    setBusy(true);
    const { error } = await supabase.from("referral_settings").upsert(parsed.data);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pengaturan referral disimpan.");
    await qc.invalidateQueries({ queryKey: ["referral-settings"] });
    await qc.invalidateQueries({ queryKey: ["discount-quote"] });
  }
  if (config.isPending) return <p className="py-4">Memuat...</p>;
  if (config.error) return <p className="py-4 text-destructive">Pengaturan belum dapat dimuat.</p>;
  return <div className="mt-6 space-y-6">
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Program ajak teman</h2>
      <div className="flex items-center justify-between gap-4"><Label htmlFor="ref-active">Aktifkan kode referral</Label><Switch id="ref-active" checked={form.enabled} onCheckedChange={(enabled) => setForm({ ...form, enabled })} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="ref-type">Jenis diskon teman</Label><select id="ref-type" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value === "fixed" ? "fixed" : "percent", discount_value: 0 })} className="h-12 w-full rounded-lg border bg-card px-3"><option value="percent">Persen (%)</option><option value="fixed">Potongan rupiah</option></select></div>
        <div className="space-y-2"><Label htmlFor="ref-value">Diskon teman {form.discount_type === "percent" ? "(%)" : "(Rp)"}</Label><Input id="ref-value" type="number" min={0} max={form.discount_type === "percent" ? 100 : 2147483647} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} /></div>
      </div>
      <div className="flex items-center justify-between gap-4 border-t pt-4"><Label htmlFor="ref-reward">Berikan bonus untuk pengajak</Label><Switch id="ref-reward" checked={form.reward_enabled} onCheckedChange={(reward_enabled) => setForm({ ...form, reward_enabled })} /></div>
      {form.reward_enabled && <div className="space-y-2"><Label htmlFor="ref-amount">Bonus pengajak (Rp)</Label><Input id="ref-amount" type="number" min={0} max={2147483647} value={form.reward_amount} onChange={(e) => setForm({ ...form, reward_amount: Number(e.target.value) })} /></div>}
      <p className="text-sm text-muted-foreground">Bonus masuk setelah pembayaran teman dikonfirmasi lunas, sebagai potongan pembayaran kelas berikutnya. Kode teman berlaku sekali per akun; tidak dapat memakai kode sendiri. Perubahan berlaku untuk pendaftaran baru.</p>
      <Button onClick={save} disabled={busy}>Simpan referral</Button>
    </div>
    <div className="space-y-3 border-t pt-6">
      <h2 className="text-xl font-semibold">Riwayat ajak teman</h2>
      {activity.isPending && <p>Memuat...</p>}
      {activity.error && <p className="text-destructive">Riwayat belum dapat dimuat.</p>}
      {activity.data?.length === 0 && <p className="text-muted-foreground">Belum ada referral.</p>}
      {activity.data?.map((r) => <div key={r.id} className="rounded-lg border bg-card p-4">
        <p className="font-semibold">{r.inviter || "Pengajak"} → {r.member || "Murid"}</p>
        <p className="break-all text-sm text-muted-foreground">{r.referral_code} · {tanggal(r.created_at)}</p>
        <p className="text-sm">{r.status === "paid" ? "Lunas" : r.status === "rejected" ? "Ditolak" : "Menunggu pembayaran"} · Bonus {rupiah(r.referral_reward_amount)}</p>
      </div>)}
    </div>
  </div>;
}