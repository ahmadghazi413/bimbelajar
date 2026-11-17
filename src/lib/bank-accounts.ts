/** Daftar rekening bank untuk pembayaran manual. Disimpan sebagai JSON di settings["bank_accounts"]. */
export type BankAccount = { bank: string; number: string; holder: string };

export function parseBankAccounts(settings?: Record<string, string | null | undefined>): BankAccount[] {
  try {
    const raw = JSON.parse(settings?.["bank_accounts"] || "[]");
    if (Array.isArray(raw)) {
      const list = raw
        .map((r) => ({ bank: String(r?.bank ?? "").trim(), number: String(r?.number ?? "").trim(), holder: String(r?.holder ?? "").trim() }))
        .filter((r) => r.number);
      if (list.length) return list;
    }
  } catch {
    // JSON rusak: pakai data rekening lama di bawah.
  }
  const number = (settings?.["bank_number"] ?? "").trim();
  if (!number) return [];
  return [{ bank: (settings?.["bank_name"] ?? "").trim() || "Bank", number, holder: (settings?.["bank_holder"] ?? "").trim() }];
}
