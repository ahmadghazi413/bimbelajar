export const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Ahad"] as const;
export type Day = (typeof DAYS)[number];
export type ScheduleSlot = { day: Day; start: string; end: string; teacherId?: string };

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

const isDay = (v: unknown): v is Day => typeof v === "string" && (DAYS as readonly string[]).includes(v);

/**
 * Jadwal sebuah kelas beserta pengajar tiap hari. Memakai kolom `schedule_slots`;
 * kelas lama yang belum punya kolom itu dibaca dari teks jadwal, dengan pengajar `teacher_id` untuk semua hari.
 */
export function slotsOf(c: any): ScheduleSlot[] {
  const raw = c?.schedule_slots;
  if (Array.isArray(raw)) {
    const ok = raw
      .filter((x) => x && isDay(x.day) && typeof x.start === "string" && typeof x.end === "string")
      .map((x) => ({ day: x.day as Day, start: x.start as string, end: x.end as string, teacherId: typeof x.teacherId === "string" && x.teacherId ? x.teacherId : undefined }));
    if (ok.length) return ok;
  }
  return parseSchedule(c?.schedule).map((s) => ({ ...s, teacherId: c?.teacher_id || undefined }));
}

/** Bentuk yang disimpan ke kolom `schedule_slots`. */
export function slotsForSave(slots: ScheduleSlot[]) {
  return [...slots]
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day))
    .map((s) => (s.teacherId ? { day: s.day, start: s.start, end: s.end, teacherId: s.teacherId } : { day: s.day, start: s.start, end: s.end }));
}

/** Semua pengajar sebuah kelas tanpa duplikat, urut menurut hari. */
export function classTeacherIds(c: any): string[] {
  const ids = slotsOf(c).map((s) => s.teacherId).filter((x): x is string => !!x);
  if (!ids.length && c?.teacher_id) ids.push(c.teacher_id);
  return [...new Set(ids)];
}

export function classHasTeacher(c: any, teacherId: string): boolean {
  return c?.teacher_id === teacherId || classTeacherIds(c).includes(teacherId);
}

/** Kolom yang perlu diperbarui saat seorang pengajar dihapus dari sebuah kelas; null bila kelas tidak terkait. */
export function removeTeacherUpdate(c: any, teacherId: string): Record<string, any> | null {
  if (!classHasTeacher(c, teacherId)) return null;
  const slots = slotsOf(c).map((s) => (s.teacherId === teacherId ? { ...s, teacherId: undefined } : s));
  return { schedule_slots: slotsForSave(slots), teacher_id: slots.find((s) => s.teacherId)?.teacherId ?? null };
}
