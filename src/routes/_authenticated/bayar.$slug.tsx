import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Landmark, MessageCircle, QrCode, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { classDetailQuery, settingsQuery } from "@/lib/queries";
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

async function qrisUrl(path: string) {
  if (!path) return "";
  const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 3600);
  return data?.signedUrl ?? "";
}

function Bayar() {
  const { slug } = Route.useParams();
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data: c } = useQuery(classDetailQuery(slug));
  const { data: settings } = useQuery(settingsQuery);
  const { data: qris } = useQuery({
    queryKey: ["qris", settings?.["qris_image_url"]],
    enabled: !!settings,
    queryFn: () => qrisUrl(settings!["qris_image_url"] ?? ""),
  });
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
  const wa = settings?.["admin_whatsapp"] ? `https://wa.me/${settings["admin_whatsapp"]}` : "";

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

  async function uploadProof(file: File) {
    if (!e) return;
    setBusy(true);
    const path = `${userId}/${e.id}-${file.name}`;
    const up = await supabase.storage.from("payment-proofs").upload(path, file, { upsert: true });
    if (up.error) { setBusy(false); toast.error("Gagal mengunggah: " + up.error.message); return; }
    const { error } = await supabase.rpc("submit_proof", { _enrollment_id: e.id, _proof_url: path });
    setBusy(false);
    if (error) { toast.error("Gagal menyimpan bukti: " + error.message); return; }
    toast.success("Bukti pembayaran terkirim. Admin akan mengecek.");
    qc.invalidateQueries({ queryKey: ["my-enrollment", slug] });
  }

  return (
    <Page title={`Daftar ${c.name} — Level ${c.level_number} ${c.level_label}`} subtitle={`${c.price_prefix} ${rupiah(c.price)} / bulan`}>
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
              <TransferInfo amount={e.amount} qris={qris ?? ""} />
              <ProofUpload busy={busy} hasProof={!!e.proof_url} onPick={uploadProof} />
              <p className="text-sm text-muted-foreground">Setelah transfer dan mengirim bukti, admin akan mengecek dan mengaktifkan kelas Anda (biasanya kurang dari 1×24 jam).</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4 rounded-3xl border bg-card p-6">
          {e?.status === "rejected" && <p className="text-destructive">Pembayaran sebelumnya ditolak. Silakan daftar ulang.</p>}
          <TransferInfo amount={c.price} qris={qris ?? ""} />
          <div className="space-y-2">
            <Label htmlFor="s">Nama pemilik rekening pengirim</Label>
            <Input id="s" value={sender} onChange={(ev) => setSender(ev.target.value)} className="h-12" placeholder="Contoh: Siti Aminah" />
          </div>
          <Button variant="hero" size="lg" className="w-full" disabled={busy || !sender} onClick={daftar}>Saya Sudah / Akan Transfer</Button>
        </div>
      )}
      {wa && (
        <Button asChild variant="success" size="lg" className="mt-4 w-full">
          <a href={wa} target="_blank" rel="noreferrer"><MessageCircle /> Butuh bantuan? Chat Admin</a>
        </Button>
      )}
      <h2 className="mb-4 mt-8 text-2xl font-semibold">Sesi yang akan dipelajari</h2>
      <SessionList sessions={c.class_sessions} />
    </Page>
  );
}

function TransferInfo({ amount, qris }: { amount: number; qris: string }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-secondary p-4 text-secondary-foreground">
        <p className="flex items-center gap-2 font-semibold"><Landmark className="h-5 w-5" /> Transfer ke rekening {BANK.bank}</p>
        <p className="mt-2 font-display text-2xl tracking-wider">{BANK.number}</p>
        <p className="text-sm">a.n. {BANK.holder}</p>
        <p className="mt-3 text-sm">Jumlah: <b>{rupiah(amount)}</b></p>
      </div>
      <div className="rounded-2xl border p-4">
        <p className="flex items-center gap-2 font-semibold"><QrCode className="h-5 w-5" /> Atau scan QRIS</p>
        {qris ? (
          <img src={qris} alt="Kode QRIS Bimbelajar" className="mx-auto mt-3 w-full max-w-xs rounded-xl" />
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Gambar QRIS akan segera ditambahkan admin.</p>
        )}
      </div>
    </div>
  );
}

function ProofUpload({ busy, hasProof, onPick }: { busy: boolean; hasProof: boolean; onPick: (f: File) => void }) {
  return (
    <div className="rounded-2xl border border-dashed p-4">
      <Label htmlFor="proof" className="flex cursor-pointer flex-col items-center gap-2 py-2 text-center">
        <Upload className="h-6 w-6 text-primary" />
        <span className="font-semibold">{hasProof ? "Bukti sudah terkirim — ganti bukti" : "Kirim bukti pembayaran"}</span>
        <span className="text-xs text-muted-foreground">Foto/screenshot bukti transfer atau QRIS (maks 5 MB)</span>
      </Label>
      <input id="proof" type="file" accept="image/*" className="hidden" disabled={busy}
        onChange={(ev) => { const f = ev.target.files?.[0]; if (f) onPick(f); ev.target.value = ""; }} />
    </div>
  );
}
