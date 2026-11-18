import { supabase } from "@/integrations/supabase/client";

export const FILE_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
export const SUBMISSION_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.mp3,.m4a,.wav,.ogg,.aac,.webm,.mp4,.mov,.m4v,.mkv";
const ALLOWED_EXT = SUBMISSION_ACCEPT.replace(/\./g, "").split(",");

export function fileExt(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return (m?.[1] ?? "").toLowerCase();
}

export function isAudioFile(name: string): boolean {
  const ext = fileExt(name);
  return ["mp3", "m4a", "wav", "ogg", "aac", "webm"].includes(ext);
}

export function isVideoFile(name: string): boolean {
  const ext = fileExt(name);
  return ["mp4", "mov", "m4v", "mkv"].includes(ext);
}

export function validateSubmissionFile(file: Pick<File, "name" | "size">) {
  if (!ALLOWED_EXT.includes(fileExt(file.name))) {
    throw new Error("Format file belum didukung. Gunakan PDF, foto, video, Word, atau rekaman suara.");
  }
  if (file.size === 0 || file.size > FILE_MAX_BYTES) {
    throw new Error("Ukuran file maksimal 50 MB dan tidak boleh kosong.");
  }
}

/** Ambil URL file privat (berlaku 1 jam). */
export async function getPrivateFileUrl(bucket: string, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "File tidak dapat dibuka.");
  }
  return data.signedUrl;
}

/** Buka file privat lewat jendela baru link sementara (berlaku 1 jam). */
export async function openPrivateFile(bucket: string, path: string) {
  const win = window.open("about:blank", "_blank");
  try {
    const signedUrl = await getPrivateFileUrl(bucket, path);
    if (win) win.location.href = signedUrl;
    else window.location.href = signedUrl;
  } catch (error) {
    win?.close();
    throw error;
  }
}
