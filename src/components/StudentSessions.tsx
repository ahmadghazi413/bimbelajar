import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, FileText, Mic, PlayCircle, Upload, Video as VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionList } from "@/components/SessionList";
import { VoiceNoteRecorder } from "@/components/VoiceNoteRecorder";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { tanggal, toEmbedUrl } from "@/lib/format";
import {
  fileExt,
  getPrivateFileUrl,
  isAudioFile,
  openPrivateFile,
  validateSubmissionFile,
} from "@/lib/session-content";

type Priv = { session_id: string; zoom_link: string; material_path: string; material_name: string };
type Rec = { session_id: string; video_url: string };
type Sub = { session_id: string; file_path: string; file_name: string; created_at: string };
type Res = { session_id: string; grade: number | null; feedback: string };

function SessionItem({
  s,
  classId,
  userId,
  priv,
  rec,
  sub,
  res,
  onChanged,
  highlight = false,
}: {
  s: Tables<"class_sessions">;
  classId: string;
  userId: string;
  priv?: Priv | undefined;
  rec?: Rec | undefined;
  sub?: Sub | undefined;
  res?: Res | undefined;
  onChanged: () => void;
  highlight?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadMode, setUploadMode] = useState<"none" | "voice">("none");
  const [subAudioUrl, setSubAudioUrl] = useState<string | null>(null);

  const fileDocRef = useRef<HTMLInputElement>(null);
  const fileVideoRef = useRef<HTMLInputElement>(null);
  const embed = rec ? toEmbedUrl(rec.video_url) : null;

  // Jika tugas berupa audio, muat url pemutar audio langsung
  useEffect(() => {
    let active = true;
    if (sub?.file_path && isAudioFile(sub.file_name)) {
      getPrivateFileUrl("assignments", sub.file_path)
        .then((url) => {
          if (active) setSubAudioUrl(url);
        })
        .catch(() => {
          if (active) setSubAudioUrl(null);
        });
    } else {
      setSubAudioUrl(null);
    }
    return () => {
      active = false;
    };
  }, [sub?.file_path, sub?.file_name]);

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
    toast.success("Tugas berhasil dikirim.");
    setBusy(false);
    setUploadMode("none");
    onChanged();
  }

  const graded = !!res && (res.grade != null || !!res.feedback);

  return (
    <li className={`overflow-hidden rounded-2xl border bg-card ${highlight ? "border-primary ring-1 ring-primary/20" : ""}`}>
      <div className="flex items-center gap-2 p-2.5">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${highlight ? "bg-primary/10 text-primary" : "bg-secondary text-primary"}`}>
            {s.number}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{s.title}</span>
            <span className="block text-xs text-muted-foreground">
              {s.scheduled_at || "Jadwal menyusul"}
              {highlight ? " · berikutnya" : ""}
            </span>
          </span>
          {graded && res!.grade != null && (
            <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
              Nilai {res!.grade}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {priv?.zoom_link && (
          <Button asChild size="sm" variant="hero" className="shrink-0">
            <a href={priv.zoom_link} target="_blank" rel="noreferrer">
              <VideoIcon /> Zoom
            </a>
          </Button>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 border-t px-3 pb-3 pt-3">
          {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}

          <div className="flex flex-wrap gap-2">
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

          {playing && rec && (
            embed ? (
              <div className="space-y-2">
                <div className="-mx-3 aspect-video bg-foreground">
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
              <a href={rec.video_url} target="_blank" rel="noreferrer" className="block text-sm text-primary underline">
                Buka video
              </a>
            )
          )}

          {/* BAGIAN PENGUMPULAN TUGAS */}
          <div className="space-y-2.5 rounded-xl bg-secondary/50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Tugas Sesi</p>
              {sub && (
                <span className="text-xs font-medium text-emerald-600">✓ Sudah mengumpulkan</span>
              )}
            </div>

            {sub ? (
              <div className="space-y-1.5 rounded-lg border bg-background/80 p-2.5">
                <p className="text-xs text-muted-foreground">
                  Terkirim: <span className="font-medium text-foreground">{sub.file_name}</span> · {tanggal(sub.created_at)}
                </p>
                {/* Jika voice note / audio, tampilkan pemutar audio langsung */}
                {subAudioUrl ? (
                  <div className="pt-1">
                    <p className="mb-1 text-[11px] text-muted-foreground font-medium">Putar rekaman suara:</p>
                    <audio src={subAudioUrl} controls className="h-8 w-full rounded" />
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      className="text-xs text-primary underline"
                      onClick={() => open("assignments", sub.file_path)}
                    >
                      Buka file tugas
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Belum ada tugas yang dikirim untuk sesi ini.</p>
            )}

            {/* Hidden Input File untuk Dokumen dan Video */}
            <input
              ref={fileDocRef}
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) upload(f);
              }}
            />
            <input
              ref={fileVideoRef}
              type="file"
              accept="video/*,.mp4,.mov,.m4v,.mkv,.webm"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) upload(f);
              }}
            />

            {/* PEREKAM SUARA LANGSUNG (VOICE NOTE) */}
            {uploadMode === "voice" && (
              <VoiceNoteRecorder
                sessionNumber={s.number}
                busy={busy}
                onUpload={upload}
                onCancel={() => setUploadMode("none")}
              />
            )}

            {/* PILIHAN MENU UPLOAD TUGAS */}
            {uploadMode === "none" && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {sub ? "Kirim ulang / ganti tugas dengan:" : "Pilih cara pengumpulan tugas:"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    disabled={busy}
                    className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => setUploadMode("voice")}
                  >
                    <Mic className="h-3.5 w-3.5" /> Rekam Suara (VN)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    className="gap-1.5"
                    onClick={() => fileDocRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload PDF / Dokumen
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    className="gap-1.5"
                    onClick={() => fileVideoRef.current?.click()}
                  >
                    <VideoIcon className="h-3.5 w-3.5" /> Upload Video
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Mendukung rekaman langsung, file PDF, foto, video (MP4/MOV), Word, atau file audio. Maksimal 50 MB.
                </p>
              </div>
            )}
          </div>

          {/* BAGIAN NILAI & EVALUASI */}
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
        </div>
      )}
    </li>
  );
}

export function StudentSessions({
  classId,
  userId,
  sessions,
  locked,
  unlockedCount = null,
  renewSlug,
}: {
  classId: string;
  userId: string;
  sessions: Tables<"class_sessions">[];
  locked: boolean;
  unlockedCount?: number | null;
  renewSlug?: string;
}) {
  const order = sessions.filter((x) => x.is_published).map((x) => x.id);
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

  const nextId = sessions.find(
    (x) => x.is_published && !data?.rec.some((r) => r.session_id === x.id) && !!data?.priv.find((p) => p.session_id === x.id)?.zoom_link,
  )?.id;

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

  return (
    <ol className="space-y-2">
      {sessions.map((s) =>
        unlockedCount != null && order.indexOf(s.id) + 1 > unlockedCount ? (
          <li key={s.id} className="rounded-xl border border-dashed p-3 text-sm">
            <p className="font-semibold">🔒 Sesi {s.number}: {s.title}</p>
            <p className="text-muted-foreground">Paket Anda mencakup {unlockedCount} sesi. Buka sisa sesi untuk melanjutkan.</p>
            {renewSlug && (
              <a href={`/bayar/${renewSlug}`} className="mt-2 inline-block font-semibold text-primary underline">
                Buka Sisa Sesi Kelas
              </a>
            )}
          </li>
        ) : (
          <SessionItem
            key={s.id}
            s={s}
            highlight={s.id === nextId}
            classId={classId}
            userId={userId}
            priv={data?.priv.find((x) => x.session_id === s.id)}
            rec={data?.rec.find((x) => x.session_id === s.id)}
            sub={data?.sub.find((x) => x.session_id === s.id)}
            res={data?.res.find((x) => x.session_id === s.id)}
            onChanged={() => qc.invalidateQueries({ queryKey: key })}
          />
        ),
      )}
    </ol>
  );
}
