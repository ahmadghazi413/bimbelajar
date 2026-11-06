import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminDelete } from "@/components/AdminDelete";
import { rupiah, tanggal } from "@/lib/format";
import { sb, field, toDateInput } from "./shared";

export function VoucherTab() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<any | null>(null);
  const list = useQuery({
    queryKey: ["admin-vouchers"],
    queryFn: async () => {
      const { data, error } = await sb.from("vouchers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-vouchers"] });

  async function save() {
    const code = String(edit?.code ?? "").trim().toUpperCase();
    if (!code) return toast.error("Kode voucher wajib diisi.");
    const value = Number(edit.discount_value ?? 0);
    if (!(value > 0)) return toast.error("Nilai diskon harus lebih dari 0.");
    if ((edit.discount_type ?? "percent") === "percent" && value > 100) return toast.error("Diskon persen maksimal 100%.");
    const counts = String(edit.target_counts_text ?? (edit.target_counts ?? []).join(","))
      .split(",").map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0);
    const payload = {
      code,
      discount_type: edit.discount_type ?? "percent",
      discount_value: value,
      max_uses: edit.max_uses === "" || edit.max_uses == null ? null : Number(edit.max_uses),
      is_active: edit.is_active ?? true,
      expires_at: edit.expires_at ? new Date(edit.expires_at).toISOString() : null,
      package_target: edit.package_target ?? "all",
      target_counts: (edit.package_target ?? "all") === "all" ? [] : counts,
    };
    const { error } = edit.id ? await sb.from("vouchers").update(payload).eq("id", edit.id) : await sb.from("vouchers").insert(payload);
    if (error) return toast.error(error.message.includes("duplicate") ? "Kode voucher sudah dipakai." : error.message);
    toast.success("Voucher disimpan.");
    setEdit(null);
    await refresh();
  }

  const scopeLabel = (v: any) => v.package_target === "monthly" ? "Paket bulanan" : v.package_target === "session" ? "Paket per sesi" : "Semua paket";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Voucher</h2>
        <Button onClick={() => setEdit({ discount_type: "percent", is_active: true, package_target: "all" })}>Tambah voucher</Button>
      </div>
      {list.isPending && <p>Memuat...</p>}
      {list.data?.length === 0 && <p className="text-muted-foreground">Belum ada voucher.</p>}
      {list.data?.map((v) => (
        <div key={v.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div className="min-w-0">
            <p className="font-mono font-semibold">{v.code} {!v.is_active && <span className="font-sans text-xs text-muted-foreground">(nonaktif)</span>}</p>
            <p className="text-sm">{v.discount_type === "percent" ? `${v.discount_value}%` : rupiah(v.discount_value)} · {scopeLabel(v)}{v.target_counts?.length ? ` (${v.target_counts.join(", ")})` : ""}</p>
            <p className="text-xs text-muted-foreground">Dipakai {v.used_count}{v.max_uses != null ? ` / ${v.max_uses}` : ""}{v.expires_at ? ` · sampai ${tanggal(v.expires_at)}` : ""}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="icon" aria-label={`Ubah ${v.code}`} onClick={() => setEdit(v)}><Pencil className="h-4 w-4" /></Button>
            <AdminDelete name={v.code} description="Voucher dihapus permanen. Riwayat pembayaran yang sudah memakainya tidak berubah." onDelete={async () => { const { error } = await sb.from("vouchers").delete().eq("id", v.id); if (error) throw new Error(error.message); await refresh(); }} />
          </div>
        </div>
      ))}
      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader><DialogTitle>{edit.id ? "Ubah voucher" : "Tambah voucher"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Kode</Label><Input value={edit.code ?? ""} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Jenis diskon</Label>
                  <select className={field} value={edit.discount_type ?? "percent"} onChange={(e) => setEdit({ ...edit, discount_type: e.target.value })}>
                    <option value="percent">Persen (%)</option><option value="fixed">Potongan rupiah</option>
                  </select></div>
                <div className="space-y-1"><Label>Nilai diskon</Label><Input type="number" min={0} value={edit.discount_value ?? ""} onChange={(e) => setEdit({ ...edit, discount_value: Number(e.target.value) })} /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Batas pemakaian (kosong = tanpa batas)</Label><Input type="number" min={0} value={edit.max_uses ?? ""} onChange={(e) => setEdit({ ...edit, max_uses: e.target.value })} /></div>
                <div className="space-y-1"><Label>Berlaku sampai (opsional)</Label><Input type="datetime-local" value={toDateInput(edit.expires_at)} onChange={(e) => setEdit({ ...edit, expires_at: e.target.value })} /></div>
              </div>
              <div className="space-y-1"><Label>Berlaku untuk paket</Label>
                <select className={field} value={edit.package_target ?? "all"} onChange={(e) => setEdit({ ...edit, package_target: e.target.value })}>
                  <option value="all">Semua paket</option><option value="monthly">Hanya bulanan</option><option value="session">Hanya per sesi</option>
                </select></div>
              {(edit.package_target ?? "all") !== "all" && (
                <div className="space-y-1"><Label>{edit.package_target === "monthly" ? "Jumlah bulan yang berlaku (mis. 1,2,3)" : "Jumlah sesi yang berlaku (mis. 4,8)"}</Label>
                  <Input value={edit.target_counts_text ?? (edit.target_counts ?? []).join(",")} onChange={(e) => setEdit({ ...edit, target_counts_text: e.target.value })} placeholder="Kosong = semua jumlah" /></div>
              )}
              <div className="flex items-center justify-between"><Label>Aktif</Label><Switch checked={edit.is_active ?? true} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} /></div>
              <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setEdit(null)}>Batal</Button><Button onClick={save}>Simpan</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
