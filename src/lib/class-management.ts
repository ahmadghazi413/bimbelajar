export function classesInSubject<T extends { subject_id: string | null }>(classes: T[], subjectId: string) {
  return classes.filter((c) => c.subject_id === subjectId);
}

export function classLevelName(c: { name: string; level_number: number; level_label: string }) {
  return `${c.name} · Level ${c.level_number} · ${c.level_label}`;
}