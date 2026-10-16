import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { classDetailQuery } from "@/lib/queries";
import { rupiah } from "@/lib/format";
import { Page, StatusBadge } from "@/components/PageTitle";
import { SessionList } from "@/components/SessionList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/bayar/$slug")({
  head: () => ({ meta: [{ title: "Pembayaran Kelas — Bimbelajar" }] }),
  component: Bayar,
});

const BANK = { bank: "BCA", number: "1234567890", holder: "Yayasan Bimbelajar" };

function Bayar() {
  const { slug } = Route.useParams();
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data: c } = useQuery(classDetailQuery(slug));
  const enr = useQuery({
    queryKey: ["my-enrollment", slug],
    enabled: !!c,
    queryFn: async () => {
      const { data } = await supabase.from("enrollments").select("*").eq("class_id", c!.id).eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });
  const [sender, setSender] = useState("");
  const [busy, setBusy] = useState(false);

  if (!c) return <Page title="Memuat...">{null}</Page>;
  const e = enr.data;

  async function daftar() {
    setBusy(true);
    const { error } = await supabase.from("enrollments").insert({
      user_id: userId, class_id: c!.id, amount: c!.price, method: `Transfer ${BANK.bank}`, sender_name: sender,
    });
    setBusy(false);
    if (error) { toast.error("Gagal mendaftar: " + error.message); return; }
    toast.success("Pendaftaran tercatat. Silakan transfer.");
    qc.invalidateQueries({ queryKey: ["my-enrollment", slug] });
  }

  return (
    <Page title={`Daftar ${c.name}`} subtitle={`${c.price_prefix} ${rupiah(c.price)} / bulan`}>
      {e && e.status !== "rejected" ? (
        <div className="space-y-4 rounded-3xl border bg-card p-6">
          <div className="flex items-center justify-between"><span className="font-semibold">Status</span><StatusBadge status={e.status} /></div>
          {e.status === "paid" ? (
            <>
              <p>Alhamdulillah, pembayaran Anda sudah lunas.</p>
              <Button asChild variant="hero" className="w-full"><Link to="/kelas-saya">Buka Kelas Saya</Link></Button>
            </>
          ) : (
            <>
              <TransferInfo amount={e.amount} />
              <p className="text-sm text-muted-foreground">Setelah transfer, admin akan mengecek dan mengaktifkan kelas Anda (biasanya kurang dari 1×24 jam). Status berubah otomatis di halaman ini.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4 rounded-3xl border bg-card p-6">
          {e?.status === "rejected" && <p className="text-destructive">Pembayaran sebelumnya ditolak. Silakan daftar ulang.</p>}
          <TransferInfo amount={c.price} />
          <div className="space-y-2">
            <Label htmlFor="s">Nama pemilik rekening pengirim</Label>
            <Input id="s" value={sender} onChange={(ev) => setSender(ev.target.value)} className="h-12" placeholder="Contoh: Siti Aminah" />
          </div>
          <Button variant="hero" size="lg" className="w-full" disabled={busy || !sender} onClick={daftar}>Saya Sudah / Akan Transfer</Button>
          <p className="text-xs text-muted-foreground">Pembayaran online (Virtual Account, QRIS, e-wallet) segera hadir.</p>
        </div>
      )}
      <h2 className="mb-4 mt-8 text-2xl font-semibold">Sesi yang akan dipelajari</h2>
      <SessionList sessions={c.class_sessions} />
    </Page>
  );
}

function TransferInfo({ amount }: { amount: number }) {
  return (
    <div className="rounded-2xl bg-secondary p-4 text-secondary-foreground">
      <p className="flex items-center gap-2 font-semibold"><Landmark className="h-5 w-5" /> Transfer ke rekening {BANK.bank}</p>
      <p className="mt-2 font-display text-2xl tracking-wider">{BANK.number}</p>
      <p className="text-sm">a.n. {BANK.holder}</p>
      <p className="mt-3 text-sm">Jumlah: <b>{rupiah(amount)}</b></p>
    </div>
  );
}
