/** Harga per paket. Setiap paket (1 bulan, 2 bulan, 4 sesi, 8 sesi, dst.) punya harga sendiri, bukan kelipatan. */
export type PackageKind = "monthly" | "session";
export type PricePair = { normal: number; promo: number };
export type PackagePrices = { monthly?: Record<string, PricePair>; session?: Record<string, PricePair> };

export const MONTH_CHOICES = [1, 2, 3, 6, 12] as const;
export const SESSION_CHOICES = Array.from({ length: 30 }, (_, i) => i + 1);

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? Math.round(x) : 0;
};

export function parsePackagePrices(value: unknown): PackagePrices {
  if (!value || typeof value !== "object") return {};
  const out: PackagePrices = {};
  for (const kind of ["monthly", "session"] as const) {
    const rows = (value as Record<string, unknown>)[kind];
    if (!rows || typeof rows !== "object") continue;
    out[kind] = {};
    for (const [count, pair] of Object.entries(rows as Record<string, any>)) {
      out[kind]![count] = { normal: n(pair?.normal), promo: n(pair?.promo) };
    }
  }
  return out;
}

export type ResolvedPrice = { normal: number; promo: number; final: number; hasPromo: boolean };

export function resolve(pair: PricePair): ResolvedPrice {
  const hasPromo = pair.promo > 0 && pair.promo < pair.normal;
  return { normal: pair.normal, promo: hasPromo ? pair.promo : 0, final: hasPromo ? pair.promo : pair.normal, hasPromo };
}

/**
 * Harga satu paket. Memakai tabel `package_prices`; kalau kelas lama belum punya,
 * jatuh ke harga lama (harga satuan dikali jumlah) supaya kelas lama tetap jalan.
 */
export function getPackagePrice(c: any, kind: PackageKind, count: number): ResolvedPrice {
  const table = parsePackagePrices(c?.package_prices);
  const hit = table[kind]?.[String(count)];
  if (hit && hit.normal > 0) return resolve(hit);
  if (kind === "monthly") {
    const normal = n(c?.price_normal) || n(c?.price);
    const promo = n(c?.price_promo);
    return resolve({ normal: normal * count, promo: promo * count });
  }
  const normal = n(c?.price_per_session_normal) || n(c?.price_per_session) || Math.round(n(c?.price) / 8);
  const promo = n(c?.price_per_session_promo);
  return resolve({ normal: normal * count, promo: promo * count });
}

/** Jumlah paket yang dijual untuk jenis tertentu, urut kecil → besar. */
export function packageCounts(c: any, kind: PackageKind): number[] {
  const table = parsePackagePrices(c?.package_prices);
  const fromTable = Object.entries(table[kind] ?? {}).filter(([, p]) => p.normal > 0).map(([k]) => Number(k));
  const fallback = kind === "monthly" ? c?.available_months : c?.available_sessions;
  const list = fromTable.length ? fromTable : Array.isArray(fallback) ? fallback.map(Number) : [];
  return [...new Set(list.filter((x) => Number.isInteger(x) && x > 0))].sort((a, b) => a - b);
}

/** Satuan paket kelas dalam minggu: 1, 2, 3, atau 4 (= 1 bulan). */
export function unitWeeks(c: any): number {
  const w = Number(c?.package_weeks);
  return Number.isInteger(w) && w > 0 ? Math.min(w, 4) : 4;
}

/** Pilihan jumlah paket bulanan. Satuan mingguan dibatasi maksimal 3 minggu agar masa aktif tidak salah dihitung. */
export function monthlyChoices(weeks: number): number[] {
  return weeks >= 4 ? [...MONTH_CHOICES] : Array.from({ length: Math.floor(3 / weeks) }, (_, i) => i + 1);
}

/** "2 bulan", "3 minggu", "8 sesi". `weeks` = satuan paket kelas (4 = bulan). */
export function packageLabel(kind: PackageKind, count: number, weeks = 4) {
  if (kind === "session") return `${count} sesi`;
  return weeks >= 4 ? `${count} bulan` : `${count * weeks} minggu`;
}

/** Paket termurah untuk ditampilkan di kartu kelas ("Mulai dari ..."). */
export function startingPrice(c: any): (ResolvedPrice & { label: string }) | null {
  const allowed: string[] = c?.allowed_packages?.length ? c.allowed_packages : ["monthly"];
  const rows: (ResolvedPrice & { label: string })[] = [];
  for (const kind of ["monthly", "session"] as const) {
    if (!allowed.includes(kind)) continue;
    const counts = packageCounts(c, kind);
    for (const count of counts.length ? counts : [1]) rows.push({ ...getPackagePrice(c, kind, count), label: packageLabel(kind, count, unitWeeks(c)) });
  }
  const priced = rows.filter((r) => r.final > 0);
  if (!priced.length) return null;
  return priced.reduce((a, b) => (b.final < a.final ? b : a));
}

/** Kunci yang sah untuk disimpan: hanya paket yang dipilih admin. */
export function buildPackagePrices(input: { monthly?: Record<string, PricePair>; session?: Record<string, PricePair> }, monthly: number[], session: number[]): PackagePrices {
  const out: PackagePrices = {};
  if (monthly.length) out.monthly = Object.fromEntries(monthly.map((m) => [String(m), { normal: n(input.monthly?.[String(m)]?.normal), promo: n(input.monthly?.[String(m)]?.promo) }]));
  if (session.length) out.session = Object.fromEntries(session.map((s) => [String(s), { normal: n(input.session?.[String(s)]?.normal), promo: n(input.session?.[String(s)]?.promo) }]));
  return out;
}
