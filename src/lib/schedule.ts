export const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Ahad"] as const;
export type Day = (typeof DAYS)[number];
export type ScheduleSlot = { day: Day; start: string; end: string };

const SLOT = /(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Ahad)\s+(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/g;

/** "Senin 19:30–21:00 WIB, Rabu 19:30–21:00 WIB" */
export function formatSchedule(slots: ScheduleSlot[]): string {
  return [...slots]
    .filter((s) => s.start && s.end)
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day))
    .map((s) => `${s.day} ${s.start}–${s.end} WIB`)
    .join(", ");
}

/** Membaca kembali jadwal yang dibuat formatSchedule. Teks lama bebas → daftar kosong. */
export function parseSchedule(text?: string | null): ScheduleSlot[] {
  const out: ScheduleSlot[] = [];
  for (const m of (text ?? "").matchAll(SLOT)) out.push({ day: m[1] as Day, start: m[2]!, end: m[3]! });
  return out;
}
