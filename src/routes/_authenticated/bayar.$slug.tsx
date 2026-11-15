import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Landmark, MessageCircle, QrCode, Upload, Zap, CreditCard, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { classDetailQuery, settingsQuery } from "@/lib/queries";
import { rupiah } from "@/lib/format";
import { getPackagePrice, packageCounts, packageLabel, startingPrice, unitWeeks } from "@/lib/package-prices";
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
import { parseBankAccounts, type BankAccount } from "@/lib/bank-accounts";

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
  const [payTab, setPayTab] = useState<"bank" | "qris">("bank");
  const [packageType, setPackageType] = useState<"monthly" | "session">("monthly");
  const [selectedSessions, setSelectedSessions] = useState<number>(8);
  const [selectedMonths, setSelectedMonths] = useState<number>(1);

  const [sender, setSender] = useState("");
  const [busy, setBusy] = useState(false);
  const [stagedProof, setStagedProof] = useState<File | null>(null);
  const [voucher, setVoucher] = useState("");
  const [applied, setApplied] = useState<{ code: string; kind: string } | null>(null);
  const [useReward, setUseReward] = useState(false);

  const balance = useQuery(referralBalanceQuery(userId));

  const progress = useQuery({
    queryKey: ["session-progress", c?.id, userId],
    enabled: !!c,
    queryFn: async () => {
      const sb = supabase as any;
      const [b, t] = await Promise.all([
        sb.rpc("sessions_bought", { _user_id: userId, _class_id: c!.id }),
        sb.rpc("class_session_count", { _class_id: c!.id }),
      ]);
      return { bought: Number(b.data ?? 0), total: Number(t.data ?? 0) };
    },
  });

  if (!c) return <Page title="Memuat...">{null}</Page>;

  const cx = c as typeof c & {
    allowed_packages?: string[];
    available_sessions?: number[];
    available_months?: number[];
    price_normal?: number | null;
    price_promo?: number | null;
    price_per_session_normal?: number | null;
    price_per_session_promo?: number | null;
  };
  const allowed = cx.allowed_packages?.length ? cx.allowed_packages : ["monthly"];
  const bought = progress.data?.bought ?? 0;
  const remaining = Math.max((progress.data?.total ?? 0) - bought, 0);
  const sessionOptions = [
    ...new Set([...packageCounts(c, "session"), ...(bought > 0 && remaining > 0 ? [remaining] : [])]),
  ].sort((a, b) => a - b);
  const effType: "monthly" | "session" = allowed.includes(packageType) ? packageType : (allowed[0] as any);
  const effSessions = sessionOptions.includes(selectedSessions) ? selectedSessions : (sessionOptions[0] ?? 0);
  const monthOptions = packageCounts(c, "monthly").filter((m) => m <= 12);
  const effMonths = monthOptions.includes(selectedMonths) ? selectedMonths : (monthOptions[0] ?? 1);

  const payMode = settings?.["payment_mode"] === "ipaymu" || settings?.["payment_mode"] === "manual"
    ? (settings["payment_mode"] as "ipaymu" | "manual")
    : "both";
  const canIpaymu = payMode !== "manual";
  const canManual = payMode !== "ipaymu";
  const effMethod: "ipaymu" | "manual" =
    paymentMethod === "ipaymu" && canIpaymu ? "ipaymu" : paymentMethod === "manual" && canManual ? "manual" : canIpaymu ? "ipaymu" : "manual";
  const e = enr.data;
  const endDate = e?.status === "paid" ? packageEnd(e as any) : null;
  const sessionTopUp = e?.status === "paid" && (e as any).package_type === "session" && bought > 0 && remaining > 0;
  const canRenew = (!!endDate && daysLeft(endDate) <= 7) || sessionTopUp;
  const wa = settings?.["admin_whatsapp"] ? `https://wa.me/${settings["admin_whatsapp"]}` : "";
  const banks = parseBankAccounts(settings);

  const monthlyEntry = getPackagePrice(c, "monthly", effMonths);
  const sessionEntry = getPackagePrice(c, "session", effSessions || 1);
  const basePrice = effType === "monthly" ? monthlyEntry.final : sessionEntry.final;
  const start = startingPrice(c);

  const quote = useQuery({
    queryKey: ["discount-quote", c?.id, applied?.code, useReward, userId, effType, effType === "session" ? effSessions : effMonths],
    enabled: !!c,
    queryFn: async () => {
      if (!c) throw new Error("Kelas tidak tersedia.");
      return discountQuote(c.id, applied?.code ?? "", useReward, { type: effType, count: effType === "session" ? effSessions : effMonths });
    },
  });

  const discountAmount = quote.data?.discount ?? 0;
  const rewardAmount = useReward ? (quote.data?.reward_used ?? 0) : 0;
  const finalPrice = Math.max(0, basePrice - discountAmount - rewardAmount);

  async function terapkanVoucher() {
    if (!voucher.trim() || !c) return;
    setBusy(true);
    try {
      const row = await discountQuote(c.id, voucher, useReward, { type: effType, count: effType === "session" ? effSessions : effMonths });
      if (row.kind === "voucher") {
        const { data: ok } = await (supabase as any).rpc("voucher_scope_ok", {
          _code: row.code,
          _package: effType,
          _count: effType === "session" ? effSessions : effMonths,
        });
        if (ok === false) throw new Error("Voucher ini tidak berlaku untuk paket yang dipilih.");
      }
      setApplied({ code: row.code ?? "", kind: row.kind ?? "" });
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
          packageType: effType,
          sessionsTotal: effType === "session" ? effSessions : undefined,
          packageMonths: effType === "monthly" ? effMonths : undefined,
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
            method: payTab === "qris" ? "QRIS" : "Transfer Bank",
            sender_name: sender.trim(),
            package_type: effType,
            sessions_total: effType === "session" ? effSessions : null,
            package_months: effType === "monthly" ? effMonths : 1,
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
      subtitle={start ? `${c.price_prefix ?? ""} ${rupiah(start.final)} / ${start.label}`.trim() : ""}
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
              <TransferInfo amount={e.amount} qris={qris ?? ""} banks={banks} tab={payTab} onTab={setPayTab} />
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

          {sessionTopUp && (
            <div className="rounded-2xl bg-primary/10 p-4 text-sm">
              <p className="font-semibold text-primary">Anda sudah membuka {bought} sesi. Tersisa {remaining} sesi lagi di kelas ini.</p>
              <p className="text-muted-foreground">Pilih "{remaining} Sesi" untuk membuka semua sisa sesi sekaligus.</p>
              <Link to="/kelas-saya" className="text-primary underline">Kembali ke Kelas Saya</Link>
            </div>
          )}
          {allowed.length > 1 && (
            <div className="space-y-2">
              <Label className="font-semibold">Pilih Paket Belajar</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPackageType("monthly")}
                  className={`rounded-2xl border p-3 text-left transition ${
                    effType === "monthly"
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  <div className="text-xs text-muted-foreground">Langganan</div>
                  <div className="text-sm font-bold">Paket Bulanan</div>
                  <div className="text-xs text-primary mt-1">Pilih lama berlangganan</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPackageType("session")}
                  className={`rounded-2xl border p-3 text-left transition ${
                    effType === "session"
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  <div className="text-xs text-muted-foreground">Fleksibel</div>
                  <div className="text-sm font-bold">Bayar Paket Sesi</div>
                  <div className="text-xs text-primary mt-1">Pilih jumlah sesi</div>
                </button>
              </div>
            </div>
          )}
          {effType === "monthly" && (
            <div className="space-y-3 rounded-2xl bg-secondary/40 p-4">
              <Label className="text-sm font-semibold">Pilih Lama Berlangganan</Label>

              {monthOptions.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {monthOptions.map((month) => (
                    <button
                      key={month}
                      type="button"
                      onClick={() => {
                        setSelectedMonths(month);
                        setApplied(null);
                      }}
                      className={`rounded-xl border p-3 text-center transition ${
                        effMonths === month
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border bg-background hover:bg-secondary"
                      }`}
                    >
                      <span className="block text-lg font-bold capitalize">{packageLabel("monthly", month, unitWeeks(c))}</span>
                      {(() => {
                        const pr = getPackagePrice(c, "monthly", month);
                        return (
                          <span className="block text-xs">
                            {pr.hasPromo && <span className="mr-1 text-muted-foreground line-through">{rupiah(pr.normal)}</span>}
                            {rupiah(pr.final)}
                          </span>
                        );
                      })()}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada durasi bulanan yang diaktifkan admin.</p>
              )}

            </div>
          )}
          {effType === "session" && (
            <div className="space-y-2 rounded-2xl bg-secondary/40 p-3">
              <Label className="text-xs font-semibold">Pilih Jumlah Pertemuan / Sesi:</Label>
              {sessionOptions.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {sessionOptions.map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSelectedSessions(num)}
                      className={`rounded-xl px-2 py-2 text-xs font-bold transition border ${
                        effSessions === num
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background border-border hover:bg-secondary"
                      }`}
                    >
                      <span className="block">{num} Sesi</span>
                      {(() => {
                        const pr = getPackagePrice(c, "session", num);
                        return (
                          <span className="block text-[11px] font-medium opacity-90">
                            {pr.hasPromo && <span className="mr-1 line-through opacity-70">{rupiah(pr.normal)}</span>}
                            {rupiah(pr.final)}
                          </span>
                        );
     
