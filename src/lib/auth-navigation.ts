export function safeAuthPath(p: unknown) {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//") && !p.includes("\\") ? p : "/kelas-saya";
}
export function isRecoveryUrl(hash: string, search: string) {
  return new URLSearchParams(hash.replace(/^#/, "")).get("type") === "recovery" || new URLSearchParams(search).get("type") === "recovery";
}