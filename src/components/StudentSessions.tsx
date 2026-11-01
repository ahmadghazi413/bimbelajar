import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, PlayCircle, Upload, Video as VideoIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { SessionList } from "@/components/SessionList";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { tanggal, toEmbedUrl } from "@/lib/format";
import { SUBMISSION_ACCEPT, fileExt, openPrivateFile, validateSubmissionFile } from "@/lib/session-content";

type Priv = { session_id: string; zoom_link: string; material_path: string; material_name: string };
type Rec = { session_id: string; video_url: string };
type Sub = { session_id: string; file_path: string; file_name: string; created_at: string };
type Res = { session_id: string; grade: number | null; feedback: string };

function SessionItem({
  s, classId, userId, priv, rec, sub, res, onChanged,
}: {
  s: Tables<"class_sessions">;
  classId: string;
  userId: string;
  priv?: Priv | undefined;
  rec?: Rec | undefined;
  sub?: Sub | undefined;
  res?: Res | undefined;
  onChanged: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const embed = rec ? toEmbedUrl(rec.video_url) : null;

  async function open(bucket: string, path: string) {
    try {
      await openPrivateFile(bucket, path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "File tidak dapat dibuka.");
    }
  }

  async function upload(file: File) {
    try {
      validateSubmissionFile(file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "File tidak valid.");
      return;
    }
    setBusy(true);
    const path = `${userId}/${s.id}/${crypto.randomUUID()}.${fileExt(file.name)}`;
    const up = await supabase.storage.from("assignments").upload(path, file);
    if (up.error) {
      toast.error("Gagal mengunggah: " + up.error.message);
      setBusy(false);
      return;
    }
    const { error } = await (supabase as any)
      .from("session_submissions")
      .upsert(
        { session_id: s.id, user_id: userId, class_id: classId, file_path: path, file_name: file.name.slice(0, 200) },
        { onConflict: "session_id,user_id" },
      );
    if (error) {
      await supabase.storage.from("assignments").remove([path]);
      toast.error("Gagal menyimpan tugas: " + error.message);
      setBusy(false);
      return;
    }
    if (sub?.file_path) await supabase.storage.from("assignments").remove([sub.file_path]);
    toast.success("Tugas terkirim.");
    setBusy(false);
    onChanged();
  }

  const graded = !!res && (res.grade != null || !!res.feedback);

  return (
    <li className="space-y-3">
      <div className="flex gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-primary">{s.number}</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{s.title}</p>
          {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
          {s.scheduled_at && <p className="text-xs text-primary">{s.scheduled_at}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {priv?.zoom_link && (
          <Button asChild size="sm" variant="hero">
            <a href={priv.zoom_link} target="_blank" rel="noreferrer"><VideoIcon /> Masuk Zoom</a>
          </Button>
        )}
        {priv?.material_path && (
          <Button size="sm" variant="outline" onClick={() => open("session-materials", priv.material_path)}>
            <FileText /> Materi PDF
          </Button>
        )}
        {rec && (
          <Button size="sm" variant="outline" onClick={() => setPlaying(!playing)}>
            <PlayCircle /> {playing ? "Tutup rekaman" : "Tonton rekaman"}
          </Button>
        )}
      </div>

      {playing && rec && (embed ? (
        <div className="space-y-2">
          {/* Lebar penuh sampai tepi kartu agar tombol layar penuh tampil di HP */}
          <div className="-mx-4 aspect-video bg-foreground">
            <iframe
              src={embed}
              title={s.title}
              className="h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
            />
          </div>
          <a href={rec.video_url} target="_blank" rel="noreferrer" className="block text-sm text-primary underline">
            Buka di aplikasi / layar penuh
          </a>
        </div>
      ) : (
        <a href={rec.video_url} target="_blank" rel="noreferrer" className="block text-sm text-primary underline">Buka video</a>
      ))}

      <div className="space-y-2 rounded-xl bg-secondary/50 p-3 text-sm">
        <p className="font-semibold">Tugas</p>
        {sub ? (
          <p className="break-all">
            Terkirim: {sub.file_name} · {tanggal(sub.created_at)}{" "}
            <button type="button" className="text-primary underline" onClick={() => open("assignments", sub.file_path)}>lihat</button>
          </p>
        ) : (
          <p className="text-muted-foreground">Belum ada tugas yang dikirim.</p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={SUBMISSION_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f);
          }}
        />
        <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload /> {busy ? "Mengunggah..." : sub ? "Ganti file tugas" : "Upload tugas"}
        </Button>
        <p className="text-xs text-muted-foreground">PDF, foto, Word, atau rekaman suara. Maksimal 20 MB.</p>
      </div>

      <div className="space-y-1 rounded-xl bg-secondary/50 p-3 text-sm">
        <p className="font-semibold">Nilai</p>
        {graded ? (
          <>
            {res!.grade != null && <p className="text-lg font-semibold text-primary">{res!.grade} / 100</p>}
            {res!.feedback && <p className="whitespace-pre-line text-muted-foreground">{res!.feedback}</p>}
          </>
        ) : (
          <p className="text-muted-foreground">Belum dinilai.</p>
        )}
      </div>
    </li>
  );
}

export function StudentSessions({
  classId, userId, sessions, locked,
}: {
  classId: string;
  userId: string;
  sessions: Tables<"class_sessions">[];
  locked: boolean;
}) {
  const qc = useQueryClient();
  const key = ["student-sessions", classId, userId];
  const { data } = useQuery({
    queryKey: key,
    enabled: !locked,
    queryFn: async () => {
      const sb = supabase as any;
      const [priv, rec, sub, res] = await Promise.all([
        sb.from("session_private").select("*").eq("class_id", classId),
        sb.from("session_recordings").select("session_id, video_url").eq("class_id", classId),
        sb.from("session_submissions").select("*").eq("class_id", classId).eq("user_id", userId),
        sb.from("session_results").select("*").eq("class_id", classId).eq("user_id", userId),
      ]);
      return {
        priv: (priv.data ?? []) as Priv[],
        rec: (rec.data ?? []) as Rec[],
        sub: (sub.data ?? []) as Sub[],
        res: (res.data ?? []) as Res[],
      };
    },
  });

  if (locked) {
    return (
      <div className="space-y-3">
        <p className="rounded-2xl bg-destructive p-4 text-sm font-semibold text-destructive-foreground">
          Paket sudah habis, jadi link Zoom, materi, rekaman, tugas, dan nilai ditutup. Perpanjang paket untuk membukanya lagi.
        </p>
        <SessionList sessions={sessions} />
      </div>
    );
  }

  const levels = [...new Set(sessions.map((s) => s.level))].sort();
  return (
    <Accordion type="single" collapsible defaultValue={`l${levels[0]}`} className="space-y-3">
      {levels.map((lv) => {
        const list = sessions.filter((s) => s.level === lv);
        return (
          <AccordionItem key={lv} value={`l${lv}`} className="rounded-2xl border bg-card px-4">
            <AccordionTrigger className="text-lg font-semibold">Level {lv} · {list.length} sesi</AccordionTrigger>
            <AccordionContent>
              <ol className="space-y-5">
                {list.map((s) => (
                  <SessionItem
                    key={s.id}
                    s={s}
                    classId={classId}
                    userId={userId}
                    priv={data?.priv.find((x) => x.session_id === s.id)}
                    rec={data?.rec.find((x) => x.session_id === s.id)}
                    sub={data?.sub.find((x) => x.session_id === s.id)}
                    res={data?.res.find((x) => x.session_id === s.id)}
                    onChanged={() => qc.invalidateQueries({ queryKey: key })}
                  />
                ))}
              </ol>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
