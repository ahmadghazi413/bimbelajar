import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Landmark, MessageCircle, QrCode, Upload, Zap, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { classDetailQuery, settingsQuery } from "@/lib/queries";
import { packageUnit, rupiah } from "@/lib/format";
import { daysLeft, packageEnd } from "@/lib/notifications";
import { Page, StatusBadge } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { discountQuote, referralBalanceQuery } from "@/lib/referral";
import { canConfirmPayment, validateProof } from "@/lib/payment-proofs";
import { PaymentProof } from "@/components/PaymentProof";
import { createIpaymuPayment } from "@/lib/ipaymu.functions";

const SESSION_OPTIONS = [1, 2, 4, 8, 10, 12, 16];

export const Route = createFileRoute("/_authenticated/bayar/$slug")({
  head: () => ({
    meta: [
      { title: "Pembayaran Kelas — Bimbelajar" },
      { name: "description", content: "Daftar kelas Bimbelajar dengan iPaymu, QRIS, transfer bank, dan kode promo." },
      { property: "og:title", content: "Pembayaran Kelas — Bimbelajar" },
      { property: "og:description", content: "Daftar kelas Bimbelajar dengan iPaymu, QRIS, transfer bank, dan kode promo." },
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

  const [paymentMethod, setPaymentMethod] = useState<"ipaymu" | "manual">("ipaymu");
  const [packageType, setPackageType] = useState<"monthly" | "session">("monthly");
  const [selectedSessions, setSelectedSessions] = useState<number>(8);

  const [sender, setSender] = useState("");
  const [busy, setBusy] = useState(false);
  const [stagedProof, setStagedProof] = useState<File | null>(null);
  const [voucher, setVoucher] = useState("");
  const [applied, setApplied] = useState<{ code: string; kind: string } | null>(null);
  const [useReward, setUseReward] = useState(false);

  const balance = useQuery(referralBalanceQuery(userId));

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

  const classExtra = c as typeof c & { price_per_session?: number | null };
  const sessionPrice =
    classExtra.price_per_session && classExtra.price_per_session > 0
      ? classExtra.price_per_session
      : Math.round(c.price / 8);

  const basePrice = packageType === "monthly" ? c.price : sessionPrice * selectedSessions;

  const quote = useQuery({
    queryKey: ["discount-quote", c?.id, applied?.code, useReward, userId, basePrice],
    enabled: !!c,
    queryFn: async () => {
      if (!c) throw new Error("Kelas tidak tersedia.");
      return discountQuote(c.id, applied?.code ?? "", useReward);
    },
  });

  const discountAmount = quote.data?.discount ?? 0;
  const rewardAmount = useReward ? (quote.data?.reward_used ?? 0) : 0;
  const finalPrice = Math.max(0, basePrice - discountAmount - rewardAmount);

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

  async function bayarIpaymu() {
    if (!c || busy) return;
    setBusy(true);
    try {
      const res = await createIpaymuPayment({
        data: {
          classId: c.id,
          amount: finalPrice,
          packageType,
          sessionsTotal: packageType === "session" ? selectedSessions : undefined,
          voucherCode: applied?.kind === "voucher" ? applied.code : null,
          referralCode: applied?.kind === "referral" ? applied.code : null,
          useReward,
          origin: window.location.origin,
        },
      });
      if (res?.url) {
        toast.success("Mengarahkan ke pembayaran iPaymu...");
        window.location.href = res.url;
      } else {
        throw new Error("Gagal membuat transaksi iPaymu.");
      }
    } catch (error) {
      toast.error(
        "Gagal memulai pembayaran instan: " +
          (error instanceof Error ? error.message : "Cek konfigurasi iPaymu atau gunakan Transfer Manual.")
      );
    } finally {
      setBusy(false);
    }
  }

  async function daftarManual() {
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
            package_type: packageType,
            sessions_total: packageType === "session" ? selectedSessions : null,
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
                  onClick={daftarManual}
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
        <div className="space-y-5 rounded-3xl border bg-card p-6">
          {canRenew && (
            <p className="font-semibold text-primary">
              Perpanjang paket. Masa berlaku baru dimulai setelah paket saat ini berakhir.
            </p>
          )}
          {e?.status === "rejected" && (
            <p className="text-destructive">Pembayaran sebelumnya ditolak. Silakan daftar ulang.</p>
          )}

          {/* Pilihan Paket: Bulanan vs Per Sesi */}
          <div className="space-y-2">
            <Label className="font-semibold">Pilih Paket Belajar</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPackageType("monthly")}
                className={`rounded-2xl border p-3 text-left transition ${
                  packageType === "monthly"
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <div className="text-xs text-muted-foreground">Langganan</div>
                <div className="text-sm font-bold">Bulanan (1 Bulan)</div>
                <div className="text-xs text-primary mt-1">{rupiah(c.price)}</div>
              </button>
              <button
                type="button"
                onClick={() => setPackageType("session")}
                className={`rounded-2xl border p-3 text-left transition ${
                  packageType === "session"
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <div className="text-xs text-muted-foreground">Fleksibel</div>
                <div className="text-sm font-bold">Paket Per Sesi</div>
                <div className="text-xs text-primary mt-1">{rupiah(sessionPrice)} / sesi</div>
              </button>
            </div>
          </div>

          {/* Jika Paket Sesi Dipilih: Pilihan Jumlah Sesi */}
          {packageType === "session" && (
            <div className="space-y-2 rounded-2xl bg-secondary/40 p-3">
              <Label className="text-xs font-semibold">Pilih Jumlah Pertemuan / Sesi:</Label>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                {SESSION_OPTIONS.map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSelectedSessions(num)}
                    className={`rounded-xl py-2 text-xs font-bold transition border ${
                      selectedSessions === num
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border hover:bg-secondary"
                    }`}
                  >
                    {num} Sesi
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Total {selectedSessions} sesi × {rupiah(sessionPrice)} = <b>{rupiah(basePrice)}</b>
              </p>
            </div>
          )}

          {/* Rincian Paket Terpilih */}
          <div className="flex items-center justify-between rounded-2xl bg-secondary/50 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Paket yang dipilih</p>
              <p className="font-semibold text-sm">
                {packageType === "monthly" ? "Paket Bulanan (Akses 30 Hari)" : `Paket ${selectedSessions} Sesi Pertemuan`}
              </p>
            </div>
            <p className="font-display text-lg font-bold text-primary">{rupiah(basePrice)}</p>
          </div>

          {/* Kode Promo / Referral */}
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
              <p className="text-sm text-success font-medium">
                {applied.kind === "referral" ? "Kode teman" : "Voucher"} diterapkan · Diskon{" "}
                {rupiah(quote.data?.discount ?? 0)}
              </p>
            )}
          </div>

          {/* Bonus Referral */}
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

          {/* Total Akhir */}
          <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
            <span className="font-semibold text-sm">Total yang Harus Dibayar</span>
            <span className="font-display text-xl font-extrabold text-primary">{rupiah(finalPrice)}</span>
          </div>

          {/* PILIHAN METODE PEMBAYARAN */}
          <div className="space-y-3 pt-2">
            <Label className="font-semibold text-sm">Pilih Cara Pembayaran:</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("ipaymu")}
                className={`flex flex-col items-start rounded-2xl border p-3.5 transition ${
                  paymentMethod === "ipaymu"
                    ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-sm">
                  <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                  Otomatis (iPaymu)
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  QRIS otomatis, VA Bank (BCA, Mandiri, BRI, BNI). Langsung lunas &amp; aktif!
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("manual")}
                className={`flex flex-col items-start rounded-2xl border p-3.5 transition ${
                  paymentMethod === "manual"
                    ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-sm">
                  <Landmark className="h-4 w-4" />
                  Transfer Manual
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Transfer ke rekening admin lalu kirim bukti transfer.
                </div>
              </button>
            </div>
          </div>

          {/* JIKA MEMILIH IPAYMU (OTOMATIS) */}
          {paymentMethod === "ipaymu" ? (
            <div className="space-y-3 rounded-2xl bg-secondary/30 p-4 border">
              <div className="flex items-start gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  Setelah menekan tombol di bawah, Anda akan diarahkan ke halaman resmi <strong>iPaymu</strong> untuk memilih metode bayar (Scan QRIS GoPay/ShopeePay/DANA/OVO atau Virtual Account). Begitu dibayar, kelas akan langsung aktif otomatis!
                </div>
              </div>

              <Button
                variant="hero"
                size="lg"
                className="w-full text-base font-bold shadow-md"
                disabled={busy || quote.isFetching || (!!voucher.trim() && !applied)}
                onClick={bayarIpaymu}
              >
                {busy ? "Menyiapkan Pembayaran..." : `Bayar Sekarang ${rupiah(finalPrice)} (iPaymu)`}
              </Button>
            </div>
          ) : (
            /* JIKA MEMILIH TRANSFER MANUAL */
            <div className="space-y-4 pt-1">
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
                onClick={daftarManual}
              >
                {busy ? "Memproses..." : "Saya sudah bayar"}
              </Button>
            </div>
          )}
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
