import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminDelete } from "@/components/AdminDelete";
import { sb, slugify, useSubjects, useClasses } from "./shared";

export function IlmuTab() {
  const { data: subjects = [] } = useSubjects();
  const { data: classes = [] } = useClasses();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<any | null>(null);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["admin-subjects"] });
    await qc.invalidateQueries({ queryKey: ["subjects"] });
  }

  async function save() {
    if (!edit?.name?.trim()) return toast.error("Nama ilmu wajib diisi.");
    const payload = {
      name: edit.name.trim(),
      slug: edit.slug?.trim() || slugify(edit.name),
      bio: edit.bio ?? "",
      sort_order: Number(edit.sort_order ?? 0),
      is_active: edit.is_active ?? true,
    };
    const { error } = edit.id
      ? await sb.from("subjects").update(payload).eq("id", edit.id)
      : await sb.from("subjects").insert(payload);
    if (error) { toast.error(error.message); return; };
    toast.success("Ilmu disimpan.");
    setEdit(null);
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Ilmu</h2>
        <Button onClick={() => setEdit({ is_active: true, sort_order: subjects.length + 1 })}>Tambah ilmu</Button>
      </div>
      {subjects.length === 0 && <p className="text-muted-foreground">Belum ada ilmu.</p>}
      {subjects.map((s) => {
        const n = classes.filter((c) => c.subject_id === s.id).length;
        return (
          <div key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
            <div className="min-w-0">
              <p className="font-semibold">{s.name} {!s.is_active && <span className="text-xs text-muted-foreground">(nonaktif)</span>}</p>
              <p className="text-sm text-muted-foreground">{n} kelas</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="icon" aria-label={`Ubah ${s.name}`} onClick={() => setEdit(s)}><Pencil className="h-4 w-4" /></Button>
              <AdminDelete name={s.name} description={n ? "Ilmu masih berisi kelas. Pindahkan atau hapus kelasnya dulu." : "Ilmu ini akan dihapus permanen."}
                onDelete={async () => { const { error } = await sb.from("subjects").delete().eq("id", s.id); if (error) throw new Error(error.message); await refresh(); }} />
            </div>
          </div>
        );
      })}
      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader><DialogTitle>{edit.id ? "Ubah ilmu" : "Tambah ilmu"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Nama ilmu</Label><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Deskripsi singkat</Label><Textarea value={edit.bio ?? ""} onChange={(e) => setEdit({ ...edit, bio: e.target.value })} /></div>
              <div className="space-y-1"><Label>Urutan</Label><Input type="number" value={edit.sort_order ?? 0} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></div>
              <div className="flex items-center justify-between"><Label>Tampilkan di website</Label><Switch checked={edit.is_active ?? true} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} /></div>
              <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setEdit(null)}>Batal</Button><Button onClick={save}>Simpan</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
