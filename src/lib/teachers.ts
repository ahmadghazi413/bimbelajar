export type Teacher = { id: string; name: string; email: string; classId?: string; classIds?: string[]; allClasses?: boolean; photoPath?: string; createdAt: string };
export function parseTeachers(value?: string): Teacher[] {
  try { const rows: unknown = JSON.parse(value ?? "[]"); return Array.isArray(rows) ? rows.filter((t): t is Teacher => !!t && typeof t.id === "string" && typeof t.name === "string" && typeof t.email === "string") : []; } catch { return []; }
}
export function teacherHasClass(t: Teacher, classId: string) {
  if (t.allClasses === true) return true;
  if (Array.isArray(t.classIds)) return t.classIds.includes(classId);
  return !t.classId || t.classId === "all" || t.classId === classId;
}