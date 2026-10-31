import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Landmark, MessageCircle, QrCode, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { classDetailQuery, settingsQuery } from "@/lib/queries";
import { packageTitle, packageUnit, rupiah } from "@/lib/format";
import { daysLeft, packageEnd } from "@/lib/notifications";
import { Page, StatusBadge } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { discountQuote, referralBalanceQuery } from "@/lib/referral";
import { canConfirmPayment, validateProof } from "@/lib/payment-proofs";
import { PaymentProof } from "@/components/PaymentProof";

export const Route = createFileRoute("/_authenticated/bayar/$slug")({
  head: () => ({
    meta: [
      { title: "Pembayaran Kelas — Bimbelajar" },
      { name: "description", content: "Daftar kelas Bimbelajar dengan kode teman, voucher dan pembayaran transfer." },
      { property: "og:title", content: "Pembayaran Kelas — Bimbelajar" },
      { property: "og:description", content: "Daftar kelas Bimbelajar dengan kode teman, voucher dan pembayaran transfer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Bayar,
});

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
    queryFn: () => qrisUrl(settings?.["qris_image_url"] ?? ""),
  });
  const enr = useQuery({
    queryKey: ["my-enrollment", slug],
    enabled: !!c,
    queryFn: async () => {
      if (!c) return null;
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("class_id", c.id)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [sender, setSender] = useState("");
  const [busy, setBusy] = useState(false);
  const [stagedProof, setStagedProof] = useState<File | null>(null);
  const [voucher, setVoucher] = useState("");
  const [applied, setApplied] = useState<{ code: string; kind: string } | null>(null);
  const [useReward, setUseReward] = useState(false);

  const balance = useQuery(referralBalanceQuery(userId));
  const quote = useQuery({
    queryKey: ["discount-quote", c?.id, applied?.code, useReward, userId],
    enabled: !!c,
    queryFn: async () => {
      if (!c) throw new Error("Kelas tidak tersedia.");
      return discountQuote(c.id, applied?.code ?? "", useReward);
    },
  });

  if (!c) return <Page title="Memuat...">{null}</Page>;
  const e = enr.data;
  const endDate = e?.status === "paid" ? packageEnd(e as any) : null;
  const canRenew = !!endDate && daysLeft(endDate) <= 7;
  const wa = settings?.["admin_whatsapp"] ? `https://wa.me/${settings["admin_whatsapp"]}` : "";
  const bank = {
    bank: settings?.["bank_name"] || "BCA",
    number: settings?.["bank_number"] || "1234567890",
    holder: settings?.["bank_holder"] || "Yayasan Bimbelajar",
  };

  const basePrice = c.price;

  const discountAmount = quote.data?.discount ?? 0;
  const rewardAmount = useReward ? (quote.data?.reward_used ?? 0) : 0;
  const finalPrice =
    applied || useReward ? Math.max(0, basePrice - discountAmount - rewardAmount) : basePrice;

  async function terapkanVoucher() {
    if (!voucher.trim() || !c) return;
    setBusy(true);
    try {
      const row = await discountQuote(c.id, voucher, useReward);
      setApplied({ code: row.code, kind: row.kind });
      toast.success(`Kode diterapkan. Diskon ${rupiah(row.discount)}.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : String((error as { message?: string }).message ?? "Kode tidak valid.")
      );
      setApplied(null);
    } finally {
      setBusy(false);
    }
  }

  async function daftar() {
    if (!c || !canConfirmPayment(stagedProof?.name, busy) || !stagedProof) return;
    if (
      (!e || e.status === "rejected" || canRenew) &&
      (!sender.trim() || !quote.data || quote.error || (voucher.trim() && !applied))
    )
      return;
    setBusy(true);
    try {
      let enrollment = e?.status === "pending" ? e : null;
      if (!enrollment) {
        const { data, error } = await supabase
          .from("enrollments")
          .insert({
            user_id: userId,
            class_id: c.id,
            amount: finalPrice,
            method: `Transfer ${bank.bank}`,
            sender_name: sender.trim(),
            voucher_code: applied?.kind === "voucher" ? applied.code : null,
            referral_code: applied?.kind === "referral" ? applied.code : null,
            use_referral_reward: useReward,
          } as any)
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        enrollment = data;
        qc.setQueryData(["my-enrollment", slug], data);
      }
      if (!enrollment) throw new Error("Pendaftaran belum dapat dibuat.");
      const ext = stagedProof.type === "image/png" ? "png" : stagedProof.type === "image/webp" ? "webp" : "jpg";
      const proofPath = `${userId}/${enrollment.id}-${crypto.randomUUID()}.${ext}`;
      const upload = await supabase.storage.from("payment-proofs").upload(proofPath, stagedProof);
      if (upload.error) throw new Error(upload.error.message);

      const { error } = await supabase.rpc("submit_proof", {
        _enrollment_id: enrollment.id,
        _proof_url: proofPath,
      });
      if (error) {
        await supabase.storage.from("payment-proofs").remove([proofPath]);
        throw new Error(error.message);
      }
      if (enrollment.proof_url) await supabase.storage.from("payment-proofs").remove([enrollment.proof_url]);
      setStagedProof(null);
      await qc.invalidateQueries({ queryKey: ["my-enrollment", slug] });
      await qc.invalidateQueries({ queryKey: ["referral-balance", userId] });
      toast.success("Konfirmasi dan bukti pembayaran terkirim. Admin akan mengecek.");
    } catch (error) {
      toast.error("Gagal konfirmasi: " + (error instanceof Error ? error.message : "Coba lagi."));
    } finally {
      setBusy(false);
    }
  }

  async function uploadProof(file: File) {
    if ((e?.status === "paid" && !canRenew) || busy) return;
    try {
      validateProof(file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Foto tidak valid.");
      return;
    }
    setBusy(true);
    try {
      setStagedProof(file);
      toast.success("Bukti dipilih. Tekan ‘Saya sudah bayar’ untuk mengirim.");
    } catch (error) {
      toast.error("Gagal memilih bukti: " + (error instanceof Error ? error.message : "Coba lagi."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title={`Daftar ${c.name} — Level ${c.level_number} ${c.level_label}`}
      subtitle={`${c.price_prefix} ${rupiah(c.price)} / ${packageUnit(c)}`}
    >
      {enr.isPending ? (
        <p>Memuat pendaftaran...</p>
      ) : enr.error ? (
        <p className="text-destructive">Pendaftaran belum dapat dimuat. Silakan coba lagi.</p>
      ) : e && e.status !== "rejected" && !canRenew ? (
        <div className="space-y-4 rounded-3xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Status</span>
            <StatusBadge status={e.status} />
          </div>
          {e.status === "paid" ? (
            <>
              <p>Alhamdulillah, pembayaran Anda sudah lunas.</p>
              <Button asChild variant="hero" className="w-full">
                <Link to="/kelas-saya">Buka Kelas Saya</Link>
              </Button>
            </>
          ) : (
            <>
              <TransferInfo amount={e.amount} qris={qris ?? ""} bank={bank} />
              <ProofUpload busy={busy} hasProof={!!stagedProof || !!e.proof_url} onPick={uploadProof} />
              {stagedProof && <p className="text-sm text-muted-foreground">File dipilih: {stagedProof.name}</p>}
              {(!e.proof_url || stagedProof) && (
                <Button
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={!canConfirmPayment(stagedProof?.name, busy)}
                  onClick={daftar}
                >
                  {busy ? "Memproses..." : "Saya sudah bayar"}
                </Button>
              )}
              <p className="text-sm text-muted-foreground">
                Setelah transfer dan mengirim bukti, admin akan mengecek dan mengaktifkan kelas Anda (biasanya kurang dari 1×24 jam).
              </p>
            </>
          )}
          {e.proof_url && <PaymentProof path={e.proof_url} enrollmentId={e.id} />}
        </div>
      ) : (
        <div className="space-y-4 rounded-3xl border bg-card p-6">
          {canRenew && (
            <p className="font-semibold text-primary">Perpanjang paket. Masa berlaku baru dimulai setelah paket saat ini berakhir.</p>
          )}
          {e?.status === "rejected" && (
            <p className="text-destructive">Pembayaran sebelumnya ditolak. Silakan daftar ulang.</p>
          )}

          <div className="flex items-center justify-between rounded-2xl bg-secondary/50 p-4">
            <div>
              <p className="text-sm text-muted-foreground">Paket belajar</p>
              <p className="font-semibold">{packageTitle(c)}</p>
            </div>
            <p className="font-display text-lg font-semibold text-primary">{rupiah(c.price)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="v">Kode teman / voucher (opsional)</Label>
            <div className="flex gap-2">
              <Input
                id="v"
                value={voucher}
                onChange={(ev) => {
                  setVoucher(ev.target.value);
                  setApplied(null);
                }}
                className="h-12"
                placeholder="Contoh: AJAKTEMAN"
              />
              <Button
                variant="outline"
                className="h-12"
                disabled={busy || !voucher.trim()}
                onClick={terapkanVoucher}
              >
                Terapkan
              </Button>
            </div>
            {applied && (
              <p className="text-sm text-success">
                {applied.kind === "referral" ? "Kode teman" : "Voucher"} diterapkan · Diskon{" "}
                {rupiah(quote.data?.discount ?? 0)}
              </p>
            )}
          </div>

          {(balance.data ?? 0) > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="use-reward">Gunakan saldo bonus ({rupiah(balance.data ?? 0)})</Label>
                <Switch id="use-reward" checked={useReward} onCheckedChange={setUseReward} />
              </div>
              {useReward && (
                <p className="text-sm text-success">
                  Potongan bonus: {rupiah(quote.data?.reward_used ?? 0)}
                </p>
              )}
            </div>
          )}

          {quote.error && <p className="text-sm text-destructive">{quote.error.message}</p>}

          <TransferInfo amount={finalPrice} qris={qris ?? ""} bank={bank} />

          <div className="space-y-2">
            <Label htmlFor="s">Nama pemilik rekening pengirim</Label>
            <Input
              id="s"
              value={sender}
              onChange={(ev) => setSender(ev.target.value)}
              className="h-12"
              placeholder="Contoh: Siti Aminah"
            />
          </div>

          <ProofUpload busy={busy} hasProof={!!stagedProof} onPick={uploadProof} />
          {stagedProof && <p className="text-sm text-muted-foreground">File dipilih: {stagedProof.name}</p>}

          <Button
            variant="hero"
            size="lg"
            className="w-full"
            disabled={
              !canConfirmPayment(stagedProof?.name, busy) ||
              !sender.trim() ||
              quote.isFetching ||
              !!quote.error ||
              !quote.data ||
              (!!voucher.trim() && !applied)
            }
            onClick={daftar}
          >
            {busy ? "Memproses..." : "Saya sudah bayar"}
          </Button>
        </div>
      )}

      {wa && (
        <Button asChild variant="success" size="lg" className="mt-4 w-full">
          <a href={wa} target="_blank" rel="noreferrer">
            <MessageCircle /> Butuh bantuan? Chat Admin
          </a>
        </Button>
      )}

      {c.advantages?.trim() && (
        <>
          <h2 className="mb-4 mt-8 text-2xl font-semibold">Keunggulan</h2>
          <p className="whitespace-pre-line leading-relaxed">{c.advantages}</p>
        </>
      )}
    </Page>
  );
}

function TransferInfo({
  amount,
  qris,
  bank,
}: {
  amount: number;
  qris: string;
  bank: { bank: string; number: string; holder: string };
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-secondary p-4 text-secondary-foreground">
        <p className="flex items-center gap-2 font-semibold">
          <Landmark className="h-5 w-5" /> Transfer ke rekening {bank.bank}
        </p>
        <p className="mt-2 font-display text-2xl tracking-wider">{bank.number}</p>
        <p className="text-sm">a.n. {bank.holder}</p>
        <p className="mt-3 text-sm">
          Jumlah: <b>{rupiah(amount)}</b>
        </p>
      </div>
      <div className="rounded-2xl border p-4">
        <p className="flex items-center gap-2 font-semibold">
          <QrCode className="h-5 w-5" /> Atau scan QRIS
        </p>
        {qris ? (
          <img src={qris} alt="Kode QRIS Bimbelajar" className="mx-auto mt-3 w-full max-w-xs rounded-xl" />
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Gambar QRIS akan segera ditambahkan admin.</p>
        )}
      </div>
    </div>
  );
}

function ProofUpload({
  busy,
  hasProof,
  onPick,
}: {
  busy: boolean;
  hasProof: boolean;
  onPick: (f: File) => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed p-4">
      <Label htmlFor="proof" className="flex cursor-pointer flex-col items-center gap-2 py-2 text-center">
        <Upload className="h-6 w-6 text-primary" />
        <span className="font-semibold">
          {busy ? "Memproses..." : hasProof ? "Ganti bukti pembayaran" : "Unggah bukti pembayaran"}
        </span>
        <span className="text-xs text-muted-foreground">
          Foto/screenshot bukti transfer atau QRIS (maks 5 MB)
        </span>
      </Label>
      <input
        id="proof"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={busy}
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          if (f) onPick(f);
          ev.target.value = "";
        }}
      />
    </div>
  );
}
