import { useState, useRef, useEffect } from "react";
import { Mic, Square, Trash2, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface VoiceNoteRecorderProps {
  sessionNumber: number;
  busy: boolean;
  onUpload: (file: File) => Promise<void>;
  onCancel?: () => void;
}

export function VoiceNoteRecorder({
  sessionNumber,
  busy,
  onUpload,
  onCancel,
}: VoiceNoteRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedMime, setSelectedMime] = useState("audio/webm");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [audioUrl]);

  function formatTime(totalSeconds: number) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  async function startRecording() {
    try {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      setAudioBlob(null);
      setRecordingSeconds(0);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mime = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mime = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
          mime = "audio/ogg;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mime = "audio/mp4";
        }
      }
      setSelectedMime(mime);

      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const fullBlob = new Blob(audioChunksRef.current, { type: mime || "audio/webm" });
        setAudioBlob(fullBlob);
        const url = URL.createObjectURL(fullBlob);
        setAudioUrl(url);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      recorder.start(200);
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Mic error:", err);
      toast.error("Gagal mengakses mikrofon. Pastikan Anda telah memberikan izin mikrofon di browser.");
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  function cancelRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingSeconds(0);
    if (onCancel) onCancel();
  }

  function resetAudio() {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);
    setRecordingSeconds(0);
  }

  async function handleSend() {
    if (!audioBlob) return;
    let ext = "webm";
    if (selectedMime.includes("mp4")) ext = "m4a";
    else if (selectedMime.includes("ogg")) ext = "ogg";

    const filename = `VoiceNote_Sesi_${sessionNumber}_${Date.now()}.${ext}`;
    const file = new File([audioBlob], filename, { type: audioBlob.type });
    await onUpload(file);
  }

  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-background/90 p-3 shadow-sm">
      {!isRecording && !audioBlob && (
        <div className="flex flex-col items-center justify-center gap-2 py-3 text-center">
          <p className="text-xs text-muted-foreground">
            Rekam setoran bacaan / suara langsung dari HP atau laptop tanpa aplikasi tambahan.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={startRecording}
              disabled={busy}
            >
              <Mic className="h-4 w-4" /> Mulai Rekam Voice Note
            </Button>
            {onCancel && (
              <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
                Tutup
              </Button>
            )}
          </div>
        </div>
      )}

      {isRecording && (
        <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-red-500"></span>
            </span>
            <span className="font-mono text-sm font-semibold text-red-600">
              Merekam... {formatTime(recordingSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="gap-1.5"
              onClick={cancelRecording}
            >
              <Trash2 className="h-3.5 w-3.5" /> Batal
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={stopRecording}
            >
              <Square className="h-3.5 w-3.5 fill-current" /> Selesai
            </Button>
          </div>
        </div>
      )}

      {!isRecording && audioBlob && audioUrl && (
        <div className="space-y-3 py-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Hasil Rekaman ({formatTime(recordingSeconds)})</span>
            <span className="text-emerald-600 font-medium">Siap dikirim</span>
          </div>

          <audio src={audioUrl} controls className="h-9 w-full rounded-md" />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              disabled={busy}
              onClick={resetAudio}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" /> Rekam Ulang
            </Button>

            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={busy}
              onClick={handleSend}
            >
              {busy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Mengirim...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" /> Kirim Voice Note
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
