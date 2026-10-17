export function rupiah(n: number) {
  return "Rp" + new Intl.NumberFormat("id-ID").format(n);
}

export function tanggal(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/** Ubah link YouTube / Vimeo / Google Drive / Dailymotion menjadi URL embed untuk iframe. */
export function toEmbedUrl(url: string): string | null {
  const u = url.trim();
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/);
  if (m) return `https://player.vimeo.com/video/${m[1]}${m[2] ? `?h=${m[2]}` : ""}`;
  m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  m = u.match(/(?:dailymotion\.com\/(?:video|embed\/video)\/|dai\.ly\/)([a-zA-Z0-9]+)/);
  if (m) return `https://www.dailymotion.com/embed/video/${m[1]}`;
  return null;
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu konfirmasi",
  paid: "Lunas",
  rejected: "Ditolak",
};
