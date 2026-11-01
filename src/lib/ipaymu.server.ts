// iPaymu v2 API helper (server-only). Uses Web Crypto so it runs on workerd.
const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

function creds() {
  const va = process.env["IPAYMU_VA"];
  const apiKey = process.env["IPAYMU_API_KEY"];
  if (!va || !apiKey) throw new Error("iPaymu belum dikonfigurasi.");
  const sandbox = (process.env["IPAYMU_MODE"] ?? "sandbox").toLowerCase() !== "production";
  return { va, apiKey, base: sandbox ? "https://sandbox.ipaymu.com" : "https://my.ipaymu.com" };
}

function timestamp() {
  const d = new Date(Date.now() + 7 * 3600 * 1000); // WIB
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

export async function ipaymuPost<T = any>(path: string, payload: unknown): Promise<T> {
  const { va, apiKey, base } = creds();
  const body = JSON.stringify(payload);
  const bodyHash = hex(await crypto.subtle.digest("SHA-256", enc.encode(body))).toLowerCase();
  const key = await crypto.subtle.importKey("raw", enc.encode(apiKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = hex(await crypto.subtle.sign("HMAC", key, enc.encode(`POST:${va}:${bodyHash}:${apiKey}`)));
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", va, signature, timestamp: timestamp() },
    body,
  });
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok || !json || json.Status !== 200) {
    console.error("iPaymu error", res.status, json);
    throw new Error("Gagal menghubungi iPaymu.");
  }
  return json as T;
}
