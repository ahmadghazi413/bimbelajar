import { useQuery } from "@tanstack/react-query";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { referralAccountQuery, referralBalanceQuery, referralSettingsQuery } from "@/lib/referral";
import { rupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";

export function ReferralPanel({ userId }: { userId: string }) {
  const account = useQuery(referralAccountQuery(userId));
  const balance = useQuery(referralBalanceQuery(userId));
  const config = useQuery(referralSettingsQuery);
  const code = account.data?.code;
  async function copy() {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); toast.success("Kode disalin."); }
    catch { toast.error("Tidak dapat menyalin kode. Silakan salin kode yang tertera."); }
  }
  const discount = config.data?.discount_type === "fixed" ? rupiah(config.data.discount_value) : `${config.data?.discount_value ?? 0}%`;
  const text = `Yuk belajar ngaji di Bimbelajar! Gunakan kode ${code ?? ""} saat daftar kelas untuk diskon ${discount}. https://bimbelajar.lovable.app/kelas`;
  return <section className="mt-6 space-y-3 border-t pt-6">
    <h2 className="text-xl font-semibold">Ajak Teman</h2>
    {account.isPending ? <p>Memuat kode...</p> : account.error ? <p className="text-destructive">Kode belum dapat dimuat.</p> : <p className="break-all font-mono text-xl font-semibold text-primary">{code}</p>}
    {config.data?.enabled ? <>
      <p className="text-sm text-muted-foreground">Diskon teman: {discount}{config.data.reward_enabled ? ` · Bonus Anda: ${rupiah(config.data.reward_amount)} setelah teman lunas.` : ""}</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={copy} disabled={!code}><Copy className="h-4 w-4" />Salin kode</Button><Button variant="success" asChild disabled={!code}><a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />Bagikan</a></Button></div>
    </> : <p className="text-sm text-muted-foreground">Program referral sedang nonaktif.</p>}
    <p className="font-medium">Saldo bonus: {balance.error ? "Belum dapat dimuat" : balance.isPending ? "Memuat..." : rupiah(balance.data ?? 0)}</p>
  </section>;
}