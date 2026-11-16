import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaymentProof } from "@/components/PaymentProof";
import { StatusBadge } from "@/components/PageTitle";
import { packageTitle, rupiah, tanggal } from "@/lib/format";
import { sb, field } from "./shared";

export function PesertaTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "paid" | "rejected" | "all">("pending");
  const [q, setQ] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["admin-peserta"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("enrollments")
        .select("*, classes(id, name, slug)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((data ?? []).map((r: any) => r.user_id))] as string[];
      const classIds = [...new Set((data ?? []).map((r: any) => r.class_id))] as string[];

      const [profRes, privRes] = await Promise.all([
        userIds.length ? sb.from("profiles").select("id, full_name, phone").in("id", userIds) : { data: [] },
        classIds.length ? sb.from("class_private").select("class_id, whatsapp_link").in("class_id", classIds) : { data: [] },
      ]);

      const profMap = new Map((profRes.data ?? []).map((p: any) => [p.id, p]));
      const linkMap = new Map((privRes.data ?? []).map((p: any) => [p.class_id, p.whatsapp_link]));

      return (data ?? []).map((r: any) => ({
        ...r,
        profile: profMap.get(r.user_id),
        waLink: linkMap.get(r.class_id) || "",
      })) as any[];
    },
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-peserta"] });
    await qc.invalidateQueries({ queryKey: ["notif-enrollments"] });
  };

  async function confirmLunasWithWa(id: string) {
    setLoadingId(id);
    try {
      const res = await fetch("/api/public/confirm-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId: id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Gagal mengonfirmasi pembayaran.");
        return;
      }
      toast.success("Pembayaran lunas & notifikasi WhatsApp otomatis dikirim.");
      await refresh();
    } catch {
      toast.error("Gagal menghubungkan ke server.");
    } finally {
      setLoadingId(null);
    }
  }

  async function setStatus(id: string, status: "pending" | "rejected") {
    const { error } = await sb.from("enrollments").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "rejected" ? "Pembayaran ditolak." : "Dikembalikan ke menunggu.");
    await refresh();
  }

  async function setUsed(id: string, n: number) {
    const { error } = await sb.from("enrollments").update({ sessions_used: n }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sesi terpakai diperbarui.");
    await refresh();
  }

  function getWaMessage(row: any) {
    const name = row.profile?.full_name || "Murid";
    const className = row.classes?.name || "Kelas PadatIlmu";
    const waLink = row.waLink?.trim();

    if (row.status === "paid") {
      return (
        `Assalamu'alaikum Warahmatullahi Wabarakatuh Kak ${name},\n\n` +
        `Alhamdulillah, pembayaran untuk pendaftaran kelas *${className}* telah kami konfirmasi lunas.\n\n` +
        (waLink
          ? `Silakan bergabung ke grup WhatsApp kelas melalui tautan berikut:\n${waLink}\n\n`
          : `Informasi kelas dan tautan pertemuan dapat diakses langsung melalui menu *Kelas Saya* di website PadatIlmu.\n\n`) +
        `Sampai jumpa di kelas ya kak. Semoga ilmunya berkah dan bermanfaat!\n` +
        `— Tim PadatIlmu`
      );
    }

    return (
      `Assalamu'alaikum Warahmatullahi Wabarakatuh Kak ${name},\n\n` +
      `Terima kasih telah mendaftar di kelas *${className}*. Pendaftaran saat ini masih menunggu pembayaran sebesar *${rupiah(row.amount)}*.\n\n` +
      `Silakan menyelesaikan pembayaran dan mengirimkan bukti transfernya ke sini atau unggah melalui website ya kak. Terima kasih!\n` +
      `— Tim PadatIlmu`
    );
  }

  const rows = (list.data ?? []).filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      (!q.trim() ||
        `${r.profile?.full_name ?? ""} ${r.classes?.name ?? ""} ${r.sender_name ?? ""}`
          .toLowerCase()
          .includes(q.trim().toLowerCase()))
  );
  const pendingCount = (list.data ?? []).filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">
        Peserta &amp; Pembayaran{" "}
        {pendingCount > 0 && (
          <span className="ml-1 rounded-full bg-warning px-2 py-0.5 text-xs text-warning-foreground">
            {pendingCount} menunggu
          </span>
        )}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <select className={field} value={filter} onChange={(e) => setFilter(e.target.value as any)}>
          <option value="pending">Menunggu konfirmasi</option>
          <option value="paid">Lunas</option>
          <option value="rejected">Ditolak</option>
          <option value="all">Semua</option>
        </select>
        <Input placeholder="Cari nama murid / kelas / pengirim" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list.isPending && <p>Memuat...</p>}
      {list.error && <p className="text-destructive">Data belum dapat dimuat.</p>}
      {rows.length === 0 && !list.isPending && <p className="text-muted-foreground">Tidak ada data.</p>}
      {rows.map((r) => {
        const wa = (r.profile?.phone ?? "").replace(/\D/g, "").replace(/^0/, "62");
        const waMsg = getWaMessage(r);
        const waHref = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(waMsg)}` : null;
        const isBusy = loadingId === r.id;

        return (
          <div key={r.id} className="space-y-3 rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{r.profile?.full_name || "Murid"}</p>
                <p className="text-sm text-muted-foreground">
                  {r.classes?.name} ·{" "}
                  {r.package_type === "session"
                    ? `${r.sessions_total} sesi`
                    : packageTitle({ package_type: r.package_type, package_weeks: r.package_weeks })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tanggal(r.created_at)} · {r.method}
                  {r.sender_name ? ` · a.n. ${r.sender_name}` : ""}
                </p>
                <p className="font-display text-lg">{rupiah(r.amount)}</p>
                {(r.voucher_code || r.referral_code) && (
                  <p className="text-xs text-muted-foreground">
                    Kode: {r.voucher_code || r.referral_code}
                    {r.reward_used ? ` · bonus dipakai ${rupiah(r.reward_used)}` : ""}
                  </p>
                )}
              </div>
              <StatusBadge status={r.status} />
            </div>

            {r.proof_url ? (
              <PaymentProof path={r.proof_url} enrollmentId={r.id} admin />
            ) : (
              r.status === "pending" && <p className="text-sm text-muted-foreground">Belum ada bukti pembayaran.</p>
            )}

            {r.status === "paid" && r.package_type === "session" && (
              <label className="flex items-center gap-2 text-sm">
                Sesi terpakai
                <Input
                  className="h-9 w-20"
                  type="number"
                  min={0}
                  max={r.sessions_total ?? 0}
                  defaultValue={r.sessions_used ?? 0}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (n !== (r.sessions_used ?? 0)) void setUsed(r.id, n);
                  }}
                />
                dari {r.sessions_total}
              </label>
            )}

            <div className="flex flex-wrap gap-2">
              {r.status !== "paid" && (
                <Button size="sm" variant="success" disabled={isBusy} onClick={() => confirmLunasWithWa(r.id)}>
                  <Send className="h-4 w-4 mr-1" />
                  {isBusy ? "Memproses..." : "Konfirmasi Lunas & Kirim WA"}
                </Button>
              )}
              {r.status === "paid" && (
                <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => confirmLunasWithWa(r.id)}>
                  <Send className="h-4 w-4 mr-1" />
                  {isBusy ? "Mengirim..." : "Kirim Ulang WA Fonnte"}
                </Button>
              )}
              {r.status !== "rejected" && (
                <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "rejected")}>
                  Tolak
                </Button>
              )}
              {r.status !== "pending" && (
                <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "pending")}>
                  Kembalikan ke menunggu
                </Button>
              )}
              {waHref && (
                <Button size="sm" variant="outline" asChild>
                  <a href={waHref} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp Manual
                  </a>
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
