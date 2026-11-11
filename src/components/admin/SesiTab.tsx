import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, GraduationCap, Pencil, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminDelete } from "@/components/AdminDelete";
import { classLevelName, classesInSubject } from "@/lib/class-management";
import { FILE_MAX_BYTES, fileExt, openPrivateFile } from "@/lib/session-content";
import { tanggal } from "@/lib/format";
import { sb, field, safeFileName, useClasses, useSubjects } from "./shared";

export function SesiTab({ allowedClassIds, teacherId, allowAll }: { allowedClassIds?: string[] | "all"; teacherId?: string; allowAll?: boolean }) {
  const { data: allClasses = [] } = useClasses();
  const { data: subjects = [] } = useSubjects();
  const classes = allowAll || allowedClassIds === "all" 
    ? allClasses 
    : teacherId 
      ? allClasses.filter((c) => c.teacher_id === teacherId || (allowedClassIds && Array.isArray(allowedClassIds) && allowedClassIds.includes(c.id)))
      : allowedClassIds && Array.isArray(allowedClassIds)
        ? allClasses.filter((c) => allowedClassIds.includes(c.id))
        : allClasses;
  const subjectIds = new Set(classes.map((c) => c.subject_id));
  const visibleSubjects = subjects.filter((s) => subjectIds.has(s.id));
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [edit, setEdit] = useState<any | null>(null);
  const [grading, setGrading] = useState<any | null>(null);
  const qc = useQueryClient();

  useEffect(() => { if (!subjectId && visibleSubjects[0]) setSubjectId(visibleSubjects[0].id); }, [visibleSubjects.length]); // eslint-disable-line
  const classOptions = classesInSubject(classes, subjectId);
  useEffect(() => { if (!classOptions.find((c) => c.id === classId)) setClassId(classOptions[0]?.id ?? ""); }, [subjectId, classes.length]); // eslint-disable-line

  const sessions = useQuery({
    queryKey: ["admin-sessions", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await sb.from("class_sessions").select("*").eq("class_id", classId).order("level").order("number");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-sessions", classId] });

  async function openEdit(s: any | null) {
    if (!s) {
      const list = sessions.data ?? [];
      const last = list[list.length - 1];
      return setEdit({ class_id: classId, level: last?.level ?? 1, number: (last?.number ?? 0) + 1, title: "", description: "", scheduled_at: "", is_published: true, zoom_link: "", material_path: "", material_name: "", video_url: "" });
    }
    const [priv, rec] = await Promise.all([
      sb.from("session_private").select("*").eq("session_id", s.id).maybeSingle(),
      sb.from("session_recordings").select("*").eq("session_id", s.id).maybeSingle(),
    ]);
    setEdit({ ...s, zoom_link: priv.data?.zoom_link ?? "", material_path: priv.data?.material_path ?? "", material_name: priv.data?.material_name ?? "", video_url: rec.data?.video_url ?? "" });
  }

  const set = (k: string, v: any) => setEdit((e: any) => ({ ...e, [k]: v }));

  async function save() {
    if (!edit?.title?.trim()) return toast.error("Judul sesi wajib diisi.");
    const base = { class_id: edit.class_id, level: Number(edit.level || 1), number: Number(edit.number || 1), title: edit.title.trim(), description: edit.description ?? "", scheduled_at: edit.scheduled_at ?? "", is_published: edit.is_published ?? true };
    const res = edit.id ? await sb.from("class_sessions").update(base).eq("id", edit.id).select("id").single() : await sb.from("class_sessions").insert(base).select("id").single();
    if (res.error) return toast.error(res.error.message.includes("duplicate") ? "Nomor sesi itu sudah dipakai di level ini." : res.error.message);
    const id = res.data.id;
    const priv = await sb.from("session_private").upsert({ session_id: id, class_id: edit.class_id, zoom_link: edit.zoom_link ?? "", material_path: edit.material_path ?? "", material_name: edit.material_name ?? "" }, { onConflict: "session_id" });
    if (priv.error) return toast.error("Sesi tersimpan, tetapi link Zoom/materi gagal: " + priv.error.message);
    const url = (edit.video_url ?? "").trim();
    const rec = url
      ? await sb.from("session_recordings").upsert({ session_id: id, class_id: edit.class_id, video_url: url }, { onConflict: "session_id" })
      : await sb.from("session_recordings").delete().eq("session_id", id);
    if (rec.error) return toast.error("Sesi tersimpan, tetapi rekaman gagal: " + rec.error.message);
    toast.success("Sesi disimpan.");
    setEdit(null);
    await refresh();
    await qc.invalidateQueries({ queryKey: ["student-sessions"] });
  }

  const fileRef = useRef<HTMLInputElement>(null);
  async function uploadMaterial(file: File) {
    if (fileExt(file.name) !== "pdf") return toast.error("Materi harus berupa file PDF.");
    if (file.size === 0 || file.size > FILE_MAX_BYTES) return toast.error("Ukuran PDF maksimal 20 MB.");
    const path = `${edit.class_id}/${safeFileName(file.name)}`;
    const up = await sb.storage.from("session-materials").upload(path, file);
    if (up.error) return toast.error("Gagal mengunggah: " + up.error.message);
    setEdit((e: any) => ({ ...e, material_path: path, material_name: file.name.slice(0, 200) }));
    toast.success("PDF terunggah. Tekan Simpan untuk menyimpan sesi.");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Sesi &amp; Nilai</h2>
        <Button disabled={!classId} onClick={() => openEdit(null)}>Tambah sesi</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label>Ilmu</Label>
          <select className={field} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {visibleSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div className="space-y-1"><Label>Kelas</Label>
          <select className={field} value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classOptions.map((c) => <option key={c.id} value={c.id}>{classLevelName(c)}</option>)}
          </select></div>
      </div>
      {!classId && <p className="text-muted-foreground">Belum ada kelas yang bisa dikelola.</p>}
      {sessions.data?.length === 0 && <p className="text-muted-foreground">Belum ada sesi di kelas ini.</p>}
      {sessions.data?.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div className="min-w-0">
            <p className="font-semibold">Sesi {s.number}: {s.title}</p>
            <p className="text-sm text-muted-foreground">{s.scheduled_at || "Jadwal belum diisi"} · {s.is_published ? "Terbit" : "Draf (tersembunyi)"}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="icon" aria-label="Nilai dan tugas" title="Nilai dan tugas" onClick={() => setGrading(s)}><GraduationCap className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" aria-label="Ubah sesi" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
            <AdminDelete name={`sesi ${s.number}`} description="Sesi beserta rekaman, link Zoom, tugas, dan nilai terkait dihapus permanen."
              onDelete={async () => { const { error } = await sb.from("class_sessions").delete().eq("id", s.id); if (error) throw new Error(error.message); await refresh(); }} />
          </div>
        </div>
      ))}

      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
            <DialogHeader><DialogTitle>{edit.id ? "Ubah sesi" : "Tambah sesi"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
  <Label>Nomor sesi</Label>
  <Input type="number" min={1} value={edit.number} onChange={(e) => set("number", Number(e.target.value))} placeholder="Misal: 1" />
</div>
              <div className="space-y-1"><Label>Judul</Label><Input value={edit.title} onChange={(e) => set("title", e.target.value)} /></div>
              <div className="space-y-1"><Label>Deskripsi</Label><Textarea value={edit.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
              <div className="space-y-1"><Label>Jadwal sesi</Label><Input value={edit.scheduled_at ?? ""} onChange={(e) => set("scheduled_at", e.target.value)} placeholder="Jumat, 14 Nov 2026 · 19.30 WIB" /></div>
              <div className="space-y-1"><Label>Link Zoom sesi ini</Label><Input value={edit.zoom_link ?? ""} onChange={(e) => set("zoom_link", e.target.value)} /></div>
              <div className="space-y-1"><Label>Link video rekaman (YouTube / Drive / Vimeo)</Label><Input value={edit.video_url ?? ""} onChange={(e) => set("video_url", e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Materi PDF</Label>
                {edit.material_path ? (
                  <p className="flex flex-wrap items-center gap-2 text-sm"><FileText className="h-4 w-4" />{edit.material_name}
                    <button type="button" className="text-primary underline" onClick={() => openPrivateFile("session-materials", edit.material_path).catch((e) => toast.error(e.message))}>lihat</button>
                    <button type="button" className="text-destructive underline" onClick={() => setEdit((e: any) => ({ ...e, material_path: "", material_name: "" }))}>hapus</button></p>
                ) : <p className="text-sm text-muted-foreground">Belum ada PDF.</p>}
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadMaterial(f); }} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> {edit.material_path ? "Ganti PDF" : "Unggah PDF"}</Button>
              </div>
              <div className="flex items-center justify-between"><Label>Terbitkan sesi (tampil ke murid)</Label><Switch checked={edit.is_published ?? true} onCheckedChange={(v) => set("is_published", v)} /></div>
              <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setEdit(null)}>Batal</Button><Button onClick={save}>Simpan</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {grading && <GradingDialog session={grading} onClose={() => setGrading(null)} />}
    </div>
  );
}

function GradingDialog({ session, onClose }: { session: any; onClose: () => void }) {
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ["admin-grading", session.id],
    queryFn: async () => {
      const [enr, subs, res] = await Promise.all([
        sb.from("enrollments").select("user_id").eq("class_id", session.class_id).eq("status", "paid"),
        sb.from("session_submissions").select("*").eq("session_id", session.id),
        sb.from("session_results").select("*").eq("session_id", session.id),
      ]);
      const ids = [...new Set((enr.data ?? []).map((e: any) => e.user_id))] as string[];
      const prof = ids.length ? await sb.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
      return { ids, subs: (subs.data ?? []) as any[], res: (res.data ?? []) as any[], names: (prof.data ?? []) as any[] };
    },
  });
  const [draft, setDraft] = useState<Record<string, { grade: string; feedback: string }>>({});
  const merged = useMemo(() => (data.data?.ids ?? []).map((uid) => {
    const r = data.data!.res.find((x) => x.user_id === uid);
    const d = draft[uid] ?? { grade: r?.grade != null ? String(r.grade) : "", feedback: r?.feedback ?? "" };
    return { uid, name: data.data!.names.find((p) => p.id === uid)?.full_name || "Murid", sub: data.data!.subs.find((x) => x.user_id === uid), d };
  }), [data.data, draft]);

  async function saveOne(uid: string, d: { grade: string; feedback: string }) {
    const grade = d.grade.trim() === "" ? null : Number(d.grade);
    if (grade != null && (!Number.isFinite(grade) || grade < 0 || grade > 100)) return toast.error("Nilai harus 0 sampai 100.");
    const { error } = await sb.from("session_results").upsert({ session_id: session.id, user_id: uid, class_id: session.class_id, grade, feedback: d.feedback }, { onConflict: "session_id,user_id" });
    if (error) return toast.error(error.message);
    toast.success("Nilai disimpan.");
    await qc.invalidateQueries({ queryKey: ["admin-grading", session.id] });
    await qc.invalidateQueries({ queryKey: ["student-sessions"] });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>Nilai · Sesi {session.number}: {session.title}</DialogTitle></DialogHeader>
        {data.isPending && <p>Memuat...</p>}
        {merged.length === 0 && !data.isPending && <p className="text-muted-foreground">Belum ada murid lunas di kelas ini.</p>}
        <div className="space-y-4">
          {merged.map(({ uid, name, sub, d }) => (
            <div key={uid} className="space-y-2 rounded-xl border p-3">
              <p className="font-semibold">{name}</p>
              <p className="text-sm">{sub ? <>Tugas: {sub.file_name} · {tanggal(sub.created_at)} <button type="button" className="text-primary underline" onClick={() => openPrivateFile("assignments", sub.file_path).catch((e) => toast.error(e.message))}>lihat</button></> : <span className="text-muted-foreground">Belum mengirim tugas.</span>}</p>
              <div className="grid gap-2 sm:grid-cols-[110px_1fr]">
                <Input type="number" min={0} max={100} placeholder="Nilai" value={d.grade} onChange={(e) => setDraft({ ...draft, [uid]: { ...d, grade: e.target.value } })} />
                <Input placeholder="Catatan untuk murid" value={d.feedback} onChange={(e) => setDraft({ ...draft, [uid]: { ...d, feedback: e.target.value } })} />
              </div>
              <Button size="sm" onClick={() => saveOne(uid, d)}>Simpan nilai</Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
