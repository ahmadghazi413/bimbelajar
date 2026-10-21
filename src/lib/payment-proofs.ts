import { supabase } from "@/integrations/supabase/client";

export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function canConfirmPayment(proofPath: string | null | undefined, busy: boolean) {
  return !!proofPath?.trim() && !busy;
}

export function validateProof(file: Pick<File, "type" | "size">) {
  if (!PROOF_TYPES.includes(file.type)) throw new Error("Gunakan foto JPG, PNG, atau WebP.");
  if (file.size === 0 || file.size > PROOF_MAX_BYTES) throw new Error("Ukuran foto maksimal 5 MB dan tidak boleh kosong.");
}

export async function removePaymentProof(enrollmentId: string, path: string) {
  const removed = await supabase.storage.from("payment-proofs").remove([path]);
  if (removed.error) throw new Error(removed.error.message);
  // Compare the path so a concurrently submitted replacement is never cleared.
  const updated = await supabase.from("enrollments").update({ proof_url: null }).eq("id", enrollmentId).eq("proof_url", path);
  if (updated.error) throw new Error(updated.error.message);
}

export async function downloadProof(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (error) { if ((error as DOMException).name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}