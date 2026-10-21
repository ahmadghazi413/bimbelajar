import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadProof, removePaymentProof } from "@/lib/payment-proofs";
import { Button } from "@/components/ui/button";
import { AdminDelete } from "@/components/AdminDelete";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function PaymentProof({ path, enrollmentId, admin = false }: { path: string; enrollmentId: string; admin?: boolean }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);
  const proof = useQuery({
    queryKey: ["payment-proof", path],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("payment-proofs").download(path);
      if (error || !data) throw new Error(error?.message ?? "Bukti tidak tersedia.");
      return data;
    },
  });
  useEffect(() => {
    if (!proof.data) { setUrl(""); return; }
    const next = URL.createObjectURL(proof.data);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [proof.data]);

  return <div className="space-y-3">
    <p className="text-sm font-semibold">Bukti pembayaran</p>
    {proof.isPending && <p className="text-sm text-muted-foreground">Memuat foto...</p>}
    {proof.error && <div className="flex flex-wrap items-center gap-2"><p className="text-sm text-destructive">Foto bukti belum dapat dimuat.</p><Button size="sm" variant="outline" onClick={() => proof.refetch()}><RotateCw className="h-4 w-4" /> Coba lagi</Button></div>}
    {url && <img src={url} alt="Foto bukti pembayaran" className="max-h-64 w-full rounded-lg border object-contain" />}
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={!url} onClick={() => setOpen(true)}><Eye className="h-4 w-4" /> Perbesar bukti</Button>
      {admin && <>
        <Button size="sm" variant="outline" disabled={!proof.data} onClick={() => {
          if (!proof.data) return;
          const ext = proof.data.type === "image/png" ? "png" : proof.data.type === "image/webp" ? "webp" : "jpg";
          void downloadProof(proof.data, `bukti-${enrollmentId}.${ext}`);
        }}><Download className="h-4 w-4" /> Unduh bukti</Button>
        <AdminDelete name="bukti pembayaran" description="Foto bukti akan dihapus permanen. Riwayat pembayaran dan status lunas tetap tersimpan." onDelete={async () => {
          await removePaymentProof(enrollmentId, path);
          setOpen(false);
          qc.removeQueries({ queryKey: ["payment-proof", path] });
          await qc.invalidateQueries({ queryKey: ["admin-peserta"] });
          await qc.invalidateQueries({ queryKey: ["my-enrollment"] });
        }} />
      </>}
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Bukti pembayaran</DialogTitle></DialogHeader>{url && <img src={url} alt="Foto bukti pembayaran diperbesar" className="max-h-[70dvh] w-full object-contain" />}</DialogContent></Dialog>
  </div>;
}