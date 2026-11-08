export function classesInSubject<T extends { subject_id: string | null }>(classes: T[], subjectId: string) {
  return classes.filter((c) => c.subject_id === subjectId);
}

export function classLevelName(c: { name: string; level_number: number; level_label: string; target_gender?: string | null }) {
  const gender = c.target_gender === "ikhwan" ? "[Ikhwan] " : c.target_gender === "akhwat" ? "[Akhwat] " : "";
  return `${gender}${c.name}`;
}
