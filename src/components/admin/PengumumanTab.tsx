import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdminDelete } from "@/components/AdminDelete";
import { tanggal } from "@/lib/format";
import { sb } from "./shared";

export function PengumumanTab() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data, error } = await sb.from("announcements").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    await qc.invalidateQueries({ queryKey: ["notif-announcements"] });
  }
  async function add() {
    if (!title.trim()) return toast.error("Judul wajib diisi.");
    setBusy(true);
    const { error } = await sb.from("announcements").insert({ title: title.trim(), body: body.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    setTitle(""); setBody("");
    toast.success("Pengumuman terkirim ke lonceng notifikasi murid.");
    await refresh();
  }
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Pengumuman</h2>
      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="space-y-1"><Label>Judul</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="space-y-1"><Label>Isi</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <Button onClick={add} disabled={busy}>Kirim pengumuman</Button>
      </div>
      {list.data?.length === 0 && <p className="text-muted-foreground">Belum ada pengumuman.</p>}
      {list.data?.map((a) => (
        <div key={a.id} className="flex items-start justify-between gap-3 rounded-2xl border bg-card p-4">
          <div className="min-w-0"><p className="font-semibold">{a.title}</p><p className="whitespace-pre-line text-sm text-muted-foreground">{a.body}</p><p className="mt-1 text-xs text-muted-foreground">{tanggal(a.created_at)}</p></div>
          <AdminDelete name="pengumuman" description="Pengumuman akan hilang dari notifikasi murid." onDelete={async () => { const { error } = await sb.from("announcements").delete().eq("id", a.id); if (error) throw new Error(error.message); await refresh(); }} />
        </div>
      ))}
    </div>
  );
}
