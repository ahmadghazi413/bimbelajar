import { expect, it } from "vitest";
import { newPasswordSchema, passwordChangeSchema, signupSchema } from "@/lib/account-validation";

it("requires at least eight characters for a new password", () => {
  expect(newPasswordSchema.safeParse("abc1234").success).toBe(false);
  expect(newPasswordSchema.safeParse("abcd1234").success).toBe(true);
});
it("requires both letters and numbers", () => {
  expect(newPasswordSchema.safeParse("abcdefgh").success).toBe(false);
  expect(newPasswordSchema.safeParse("12345678").success).toBe(false);
  expect(newPasswordSchema.safeParse("Abcd1234").success).toBe(true);
});
it("limits new passwords to 64 characters", () => {
  expect(newPasswordSchema.safeParse("a".repeat(63) + "1").success).toBe(true);
  expect(newPasswordSchema.safeParse("a".repeat(64) + "1").success).toBe(false);
});
it("requires full name and WhatsApp during registration", () => {
  const input = { name: "Ahmad Ghazi", email: "test@example.com", password: "abcd1234", phone: "081234567890", origin: "https://padatilmu.web.id" };
  expect(signupSchema.safeParse(input).success).toBe(true);
  expect(signupSchema.safeParse({ ...input, name: "" }).success).toBe(false);
  expect(signupSchema.safeParse({ ...input, phone: "" }).success).toBe(false);
});
it("requires old password and matching new password confirmation", () => {
  const input = { email: "test@example.com", oldPassword: "lama1234", newPassword: "baru1234", confirmation: "baru1234" };
  expect(passwordChangeSchema.safeParse(input).success).toBe(true);
  expect(passwordChangeSchema.safeParse({ ...input, oldPassword: "" }).success).toBe(false);
  expect(passwordChangeSchema.safeParse({ ...input, confirmation: "beda1234" }).success).toBe(false);
});