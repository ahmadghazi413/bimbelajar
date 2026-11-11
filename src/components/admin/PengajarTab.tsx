import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminDelete } from "@/components/AdminDelete";
import { settingsQuery } from "@/lib/queries";
import { parseTeachers, type Teacher } from "@/lib/teachers";
import { sb, safeFileName, useClasses } from "./shared";

const MAX_PHOTO = 3 * 1024 * 1024;

export function PengajarTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery(settingsQuery);
  const { data: classes = [] } = useClasses();
  const teachers = parseTeachers(settings?.["teacher_list"]);
  const [edit, setEdit] = useState<Teacher | null>(null);
  const [isNew, setIsNew] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function persist(next: Teacher[]) {
    const { error } = await sb.from("settings").upsert({ key: "teacher_list", value: JSON.stringify(next) });
    if (error) throw new Error(error.message);
    await qc.invalidateQueries({ queryKey: ["settings"] });
    await qc.invalidateQueries({ queryKey: ["public-teachers"] });
  }

  async function save() {
    if (!edit) return;
    const email = edit.email.trim().toLowerCase();
    if (!edit.name.trim() || !/^\S+@\S+\.\S+$/.test(email)) return toast.error("Isi nama dan email pengajar dengan benar.");
    if (teachers.some((t) => t.id !== edit.id && t.email.toLowerCase() === email)) return toast.error("Email itu sudah terdaftar sebagai pengajar.");
    const row: Teacher = { ...edit, name: edit.name.trim(), email, classIds: edit.classIds ?? [], allClasses: !!edit.allClasses };
    delete (row as any).classId;
    try {
      await persist(isNew ? [...teachers, row] : teachers.map((t) => (t.id === row.id ? row : t)));
      toast.success("Pengajar disimpan.");
      setEdit(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal menyimpan."); }
  }

  async function uploadPhoto(file: File) {
    if (!edit) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Gunakan foto JPG, PNG, atau WebP.");
    if (file.size === 0 || file.size > MAX_PHOTO) return toast.error("Ukuran foto maksimal 3 MB.");
    const path = `${edit.id}/${safeFileName(file.name)}`;
    const up = await sb.storage.from("teacher-photos").upload(path, file);
    if (up.error) return toast.error("Gagal mengunggah: " + up.error.message);
    if (edit.photoPath) await sb.storage.from("teacher-photos").remove([edit.photoPath]);
    setEdit({ ...edit, photoPath: path });
    toast.success("Foto terunggah. Tekan Simpan untuk menyimpan pengajar.");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Pengajar</h2>
        <Button onClick={() => { setIsNew(true); setEdit({ id: crypto.randomUUID(), name: "", email: "", classIds: [], allClasses: false, createdAt: new Date().toISOString() }); }}>Tambah pengajar</Button>
      </div>
      <p className="text-sm text-muted-foreground">Pengajar masuk dengan email yang didaftarkan di sini dan mendapat Panel Guru (Sesi &amp; Nilai) untuk kelas yang dicentang.</p>
      {teachers.length === 0 && <p className="text-muted-foreground">Belum ada pengajar.</p>}
            {teachers.map((t) => {
        const taught = classes.filter((c) => c.teacher_id === t.id);
        return (
          <div key={t.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
            <div className="min-w-0">
              <p className="font-semibold">{t.name}</p>
              <p className="break-all text-sm text-muted-foreground">{t.email}</p>
              <p className="text-xs text-muted-foreground">
                {t.allClasses
                  ? "Akses: Semua kelas"
                  : taught.length > 0
                    ? `Mengajar: ${taught.map((c) => c.name).join(", ")}`
                    : "Belum ditugaskan di jadwal kelas"}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="icon" aria-label={`Ubah ${t.name}`} onClick={() => { setIsNew(false); setEdit({ ...t }); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <AdminDelete
                name={t.name}
                description="Pengajar kehilangan akses Panel Guru. Kelas yang memakai pengajar ini menjadi tanpa pengajar."
                onDelete={async () => {
                  await persist(teachers.filter((x) => x.id !== t.id));
                  const used = classes.filter((c) => c.teacher_id === t.id).map((c) => c.id);
                  if (used.length) await sb.from("classes").update({ teacher_id: null }).in("id", used);
                  if (t.photoPath) await sb.storage.from("teacher-photos").remove([t.photoPath]);
                  await qc.invalidateQueries({ queryKey: ["admin-classes"] });
                }}
              />
            </div>
          </div>
        );
      })}

      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isNew ? "Tambah pengajar" : "Ubah pengajar"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nama</Label>
                <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Email akun pengajar</Label>
                <Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Foto (opsional)</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadPhoto(f);
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" /> {edit.photoPath ? "Ganti foto" : "Unggah foto"}
                </Button>
                {edit.photoPath && <p className="text-xs text-muted-foreground">Foto sudah terpasang.</p>}
              </div>

              <div className="space-y-2 border-t pt-3">
                <Label>Akses Kelas</Label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox checked={!!edit.allClasses} onCheckedChange={(v) => setEdit({ ...edit, allClasses: !!v })} />
                  Akses ke semua kelas (Kepala Pengajar)
                </label>
                {!edit.allClasses && (
                  <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">Otomatis Terhubung dari Jadwal Kelas</p>
                    <p>
                      Pengajar ini otomatis dapat mengelola kelas yang memilih namanya di tab <strong>Kelola Kelas</strong>.
                    </p>
                    {(() => {
                      const taught = classes.filter((c) => c.teacher_id === edit.id);
                      return taught.length > 0 ? (
                        <p className="text-emerald-700 dark:text-emerald-400 font-medium pt-1">
                          Saat ini mengajar ({taught.length}): {taught.map((c) => c.name).join(", ")}
                        </p>
                      ) : (
                        <p className="italic pt-1">Saat ini belum ditugaskan di kelas mana pun.</p>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEdit(null)}>Batal</Button>
                <Button onClick={save}>Simpan</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
