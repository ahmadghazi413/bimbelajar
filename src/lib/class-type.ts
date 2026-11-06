/** Jenis paket yang dijual sebuah kelas: bulanan, per sesi, atau keduanya. */
export type ClassType = "monthly" | "session" | "both";

export function classType(c: { allowed_packages?: string[] | null }): ClassType {
  const pk = c.allowed_packages?.length ? c.allowed_packages : ["monthly"];
  const m = pk.includes("monthly");
  const s = pk.includes("session");
  return m && s ? "both" : s ? "session" : "monthly";
}

export const CLASS_TYPE_LABEL: Record<ClassType, string> = {
  monthly: "Bulanan",
  session: "Per sesi",
  both: "Bulanan + per sesi",
};
