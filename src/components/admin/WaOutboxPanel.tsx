import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sb } from "./shared";

const KIND: Record<string, string> = { payment_student: "Konfirmasi ke murid", payment_admin: "Info ke admin", class_reminder: "Pengingat kelas" };
const STATUS: Record<string, string> = { pending: "Menunggu", sending: "Mengirim", sent: "Terkirim", failed: "Gagal", skipped: "Dilewati" };

/** Riwayat pesan WhatsApp otomatis. Pesan gagal/dilewati bisa dicoba kirim ulang. */
export function WaOutboxPanel() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-wa-outbox"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await sb.from("wa_outbox").select("id, kind, status, attempts, last_error, created_at, sent_at").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  async function retry(id: string) {
    const { error } = await sb.from("wa_outbox").update({ status: "pending", attempts: 0, last_error: null, send_after: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dijadwalkan kirim ulang pada putaran berikutnya.");
    await qc.invalidateQueries({ queryKey: ["admin-wa-outbox"] });
  }

  const rows = list.data ?? [];
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <h3 className="font-semibold">Riwayat WhatsApp otomatis</h3>
      <p className="text-xs text-muted-foreground">30 pesan terakhir. Token Fonnte dan tujuan grup admin diatur di server (lihat WHATSAPP.md), bukan di halaman ini.</p>
      {list.isPending && <p className="text-sm">Memuat...</p>}
      {list.error && <p className="text-sm text-destructive">Riwayat belum dapat dimuat. Pastikan migrasi 0016 sudah dijalankan.</p>}
      {!list.isPending && !list.error && rows.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pesan.</p>}
      {rows.map((r) => (
        <div key={r.id} className="flex items-start justify-between gap-3 border-t pt-2 text-sm">
          <div className="min-w-0">
            <p className="font-medium">{KIND[r.kind] ?? r.kind} · <span className={r.status === "failed" ? "text-destructive" : r.status === "sent" ? "text-success" : ""}>{STATUS[r.status] ?? r.status}</span></p>
            <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}{r.attempts > 0 ? ` · percobaan ${r.attempts}` : ""}</p>
            {r.last_error && <p className="break-words text-xs text-muted-foreground">{r.last_error}</p>}
          </div>
          {(r.status === "failed" || r.status === "skipped") && <Button size="sm" variant="outline" onClick={() => void retry(r.id)}>Kirim ulang</Button>}
        </div>
      ))}
    </section>
  );
}
