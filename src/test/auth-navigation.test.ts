import { expect, it } from "vitest";
import { isRecoveryUrl, safeAuthPath } from "@/lib/auth-navigation";
it("recognizes recovery links regardless of the landing page", () => {
  expect(isRecoveryUrl("#type=recovery&access_token=test", "")).toBe(true);
  expect(isRecoveryUrl("", "?type=recovery")).toBe(true);
  expect(isRecoveryUrl("#type=signup", "")).toBe(false);
});
it("preserves an intended class destination and rejects external redirects", () => {
  expect(safeAuthPath("/bayar/tahsin")).toBe("/bayar/tahsin");
  expect(safeAuthPath("//evil.test")).toBe("/kelas-saya");
  expect(safeAuthPath("/\\evil.test")).toBe("/kelas-saya");
});