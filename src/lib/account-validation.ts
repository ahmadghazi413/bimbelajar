import { z } from "zod";

export const PASSWORD_MAX = 64;
export const PASSWORD_HINT = "8–64 karakter, wajib mengandung huruf dan angka.";
export const newPasswordSchema = z.string().min(8, "Password minimal 8 karakter.").max(PASSWORD_MAX, "Password maksimal 64 karakter.").regex(/[a-zA-Z]/, "Password harus mengandung huruf.").regex(/[0-9]/, "Password harus mengandung angka.");
const emailSchema = z.string().trim().email("Email tidak valid.").max(255);
export const signupSchema = z.object({
  name: z.string().trim().min(1, "Nama lengkap wajib diisi.").max(100),
  email: emailSchema,
  password: newPasswordSchema,
  phone: z.string().trim().regex(/^\+?[0-9]{9,15}$/, "Nomor WhatsApp harus 9–15 angka, contoh 081234567890."),
  origin: z.string().url(),
});
export const passwordChangeSchema = z.object({
  email: emailSchema,
  oldPassword: z.string().min(1, "Password lama wajib diisi.").max(4096),
  newPassword: newPasswordSchema,
  confirmation: z.string(),
}).refine((v) => v.newPassword === v.confirmation, { message: "Konfirmasi password baru tidak sama.", path: ["confirmation"] })
  .refine((v) => v.newPassword !== v.oldPassword, { message: "Password baru harus berbeda dari password lama.", path: ["newPassword"] });