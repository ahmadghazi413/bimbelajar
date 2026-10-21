import { describe, expect, it, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ remove: vi.fn(), update: vi.fn(), eq: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({ remove: mocks.remove }) }, from: mocks.from } }));
import { canConfirmPayment, removePaymentProof, validateProof } from "@/lib/payment-proofs";

describe("Payment proofs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.remove.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ update: mocks.update });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ eq: mocks.eq, then: (resolve: (value: unknown) => unknown) => resolve({ error: null }) });
  });
  it("accepts transfer and QRIS photos up to 5 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) expect(() => validateProof({ type, size: 5 * 1024 * 1024 })).not.toThrow();
    expect(() => validateProof({ type: "image/png", size: 5 * 1024 * 1024 + 1 })).toThrow();
  });
  it("rejects non-photo and empty uploads", () => {
    expect(() => validateProof({ type: "application/pdf", size: 100 })).toThrow();
    expect(() => validateProof({ type: "image/jpeg", size: 0 })).toThrow();
  });
  it("requires an uploaded proof before payment confirmation and blocks confirmation while uploading", () => {
    expect(canConfirmPayment(null, false)).toBe(false);
    expect(canConfirmPayment("", false)).toBe(false);
    expect(canConfirmPayment("owner/proof.png", true)).toBe(false);
    expect(canConfirmPayment("owner/proof.png", false)).toBe(true);
  });
  it("deletes only the proof, preserving payment fields and concurrent replacements", async () => {
    await removePaymentProof("payment-id", "owner/proof.png");
    expect(mocks.remove).toHaveBeenCalledWith(["owner/proof.png"]);
    expect(mocks.update).toHaveBeenCalledWith({ proof_url: null });
    expect(mocks.eq).toHaveBeenCalledWith("id", "payment-id");
    expect(mocks.eq).toHaveBeenCalledWith("proof_url", "owner/proof.png");
  });
  it("does not clear the proof pointer when deleting the file fails", async () => {
    mocks.remove.mockResolvedValue({ error: { message: "Tidak diizinkan" } });
    await expect(removePaymentProof("payment-id", "owner/proof.png")).rejects.toThrow("Tidak diizinkan");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});