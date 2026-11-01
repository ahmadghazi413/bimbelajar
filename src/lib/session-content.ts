import { supabase } from "@/integrations/supabase/client";

export const FILE_MAX_BYTES = 20 * 1024 * 1024;
export const SUBMISSION_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.mp3,.m4a,.wav,.ogg,.aac,.webm";
const ALLOWED_EXT = SUBMISSION_ACCEPT.replace(/\./g, "").split(",");

export function fileExt(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return (m?.[1] ?? "").toLowerCase();
}

export function validateSubmissionFile(file: Pick<File, "name" | "size">) {
  if (!ALLOWED_EXT.includes(fileExt(file.name))) {
    throw new Error("Format file belum didukung. Gunakan PDF, foto, Word, atau rekaman suara.");
  }
  if (file.size === 0 || file.size > FILE_MAX_BYTES) {
    throw new Error("Ukuran file maksimal 20 MB dan tidak boleh kosong.");
  }
}

/** Buka file privat lewat link sementara (berlaku 1 jam). */
export async function openPrivateFile(bucket: string, path: string) {
  // Jendela dibuka dulu agar tidak diblokir browser HP setelah proses async.
  const win = window.open("about:blank", "_blank");
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    win?.close();
    throw new Error(error?.message ?? "File tidak dapat dibuka.");
  }
  if (win) win.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}
