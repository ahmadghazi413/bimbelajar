import { slotsOf } from "@/lib/schedule";

/** Kategori kelas Tahsin: dipakai untuk filter di halaman Tahsin dan diatur dari Edit kelas. */
export type ClassCategory = "pra-tahsin" | "tahsin";

export const CATEGORY_OPTIONS: { value: ClassCategory; label: string; levelNumber: number }[] = [
  { value: "pra-tahsin", label: "Pra Tahsin", levelNumber: 1 },
  { value: "tahsin", label: "Tahsin", levelNumber: 2 },
];

/**
 * Kategori sebuah kelas. Kelas lama tetap terbaca: level 1 (Pemula) = Pra Tahsin, selain itu = Tahsin.
 * Label yang memuat kata "pra" juga dianggap Pra Tahsin.
 */
export function classCategory(c: any): ClassCategory {
  const label = String(c?.level_label ?? "").toLowerCase();
  if (/\bpra\b/.test(label)) return "pra-tahsin";
  return Number(c?.level_number) === 1 ? "pra-tahsin" : "tahsin";
}

export const categoryLabel = (c: any) => CATEGORY_OPTIONS.find((o) => o.value === classCategory(c))!.label;

/** "Jumat 19.30–21.00 WIB" */
export function slotLine(s: { day: string; start: string; end: string }) {
  return `${s.day} ${s.start.replace(":", ".")}–${s.end.replace(":", ".")} WIB`;
}

/** Semua jadwal (hari dan jam) dari satu atau beberapa rombel, tanpa duplikat. */
export function scheduleLines(classes: any[]): string[] {
  const out: string[] = [];
  for (const c of classes) {
    const slots = slotsOf(c);
    if (slots.length) for (const s of slots) out.push(slotLine(s));
    else if (c?.schedule) out.push(String(c.schedule));
  }
  return [...new Set(out)];
}
