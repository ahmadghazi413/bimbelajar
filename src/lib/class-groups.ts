/**
 * Pengelompokan rombel (Kelas A, B, C) menjadi satu program.
 * Aturan kunci sama dengan halaman publik `routes/ilmu/$slug.tsx`:
 * level + gender yang sama = satu program.
 */

export type ClassGroup = {
  key: string;
  /** Nama program tanpa akhiran "Kelas X". */
  cleanName: string;
  rombels: any[];
};

const ROMBEL_SUFFIX = /[\s\-_]+Kelas\s+([A-Za-z0-9]+)$/i;

/** "Tahsin Pemula Kelas B" → { base: "Tahsin Pemula", label: "B" }. Tanpa akhiran → label kosong. */
export function splitRombelName(name: string): { base: string; label: string } {
  const text = String(name ?? "");
  const m = text.match(ROMBEL_SUFFIX);
  const base = text.replace(ROMBEL_SUFFIX, "").trim();
  return { base: base || text.trim(), label: m ? m[1]! : "" };
}

/** Kelompokkan kelas menjadi program. Urutan program mengikuti urutan kemunculan; rombel diurutkan sort_order lalu nama. */
export function groupClasses(classes: any[]): ClassGroup[] {
  const map = new Map<string, any[]>();
  for (const c of classes) {
    const gender = c.target_gender ?? "all";
    const key = c.level_number
      ? `${c.subject_id ?? ""}|lvl-${c.level_number}-${gender}`
      : `${c.subject_id ?? ""}|cls-${splitRombelName(c.name).base}-${gender}`;
    const list = map.get(key);
    if (list) list.push(c);
    else map.set(key, [c]);
  }
  return [...map.entries()].map(([key, rombels]) => {
    rombels.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99) || String(a.name).localeCompare(String(b.name)));
    const primary = rombels[0]!;
    return { key, cleanName: splitRombelName(primary.name).base || primary.name, rombels };
  });
}

/** Nama rombel berikutnya: Kelas A → B → C. Bila belum ada yang berhuruf, kelas pertama dianggap A sehingga yang baru jadi Kelas B. */
export function nextRombelName(group: ClassGroup): string {
  let max = 0;
  for (const r of group.rombels) {
    const { label } = splitRombelName(r.name);
    const code = /^[A-Za-z]$/.test(label) ? label.toUpperCase().charCodeAt(0) - 64 : 0;
    if (code > max) max = code;
  }
  if (max === 0) max = 1; // rombel tanpa huruf dianggap Kelas A
  const next = String.fromCharCode(64 + Math.min(max + 1, 26));
  return `${group.cleanName} Kelas ${next}`;
}
