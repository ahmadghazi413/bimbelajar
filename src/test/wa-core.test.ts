import { describe, expect, it } from "vitest";
import { buildAdminPaidMessage, buildReminderMessage, buildStudentPaidMessage, dueReminders, normalizePhone, packageText, reminderExpired, wibParts } from "@/lib/wa-core";

const info = { studentName: "Ibu Siti", className: "Kelas Kecil", packageText: "1 bulan", amount: 250000, method: "iPaymu", schedule: "Selasa 19:30–20:30 WIB", waGroupLink: "https://chat.whatsapp.com/abc", siteUrl: "https://padatilmu.web.id" };

describe("normalizePhone", () => {
  it("mengubah format lokal ke 62", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("6281234567890");
    expect(normalizePhone("+6281234567890")).toBe("6281234567890");
    expect(normalizePhone("81234567890")).toBe("6281234567890");
  });
  it("membiarkan kode negara lain dan menolak yang tidak valid", () => {
    expect(normalizePhone("60123456789")).toBe("60123456789");
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe("packageText", () => {
  it("paket sesi dan bulanan", () => {
    expect(packageText({ package_type: "session", sessions_total: 8 })).toBe("8 sesi");
    expect(packageText({ package_type: "monthly", package_weeks: 8 })).toBe("2 bulan");
    expect(packageText({ package_type: "monthly" })).toBe("1 bulan");
  });
});

describe("pesan pembayaran", () => {
  it("murid menerima link grup", () => {
    const m = buildStudentPaidMessage(info);
    expect(m).toContain("https://chat.whatsapp.com/abc");
    expect(m).toContain("Rp250.000");
    expect(m).toContain("/kelas-saya");
  });
  it("tanpa link grup, murid diberi tahu admin akan mengirim", () => {
    expect(buildStudentPaidMessage({ ...info, waGroupLink: "" })).toContain("dikirim oleh admin");
  });
  it("admin diperingatkan bila nomor murid tidak valid atau link grup kosong", () => {
    const m = buildAdminPaidMessage({ ...info, waGroupLink: "", phone: null });
    expect(m).toContain("TIDAK terkirim");
    expect(m).toContain("belum diisi");
  });
});

describe("pengingat kelas", () => {
  // Selasa, 10 Nov 2026 18:45 WIB = 11:45 UTC
  const now = new Date("2026-11-10T11:45:00Z");
  const kelas = { id: "c1", name: "Kelas Kecil", schedule: "Selasa 19:30–20:30 WIB, Kamis 19:30–20:30 WIB", reminder_minutes: 60 };

  it("membaca hari dan jam WIB", () => {
    expect(wibParts(now)).toEqual({ dayIdx: 1, minutes: 18 * 60 + 45, date: "2026-11-10" });
    expect(wibParts(new Date("2026-11-14T20:00:00Z")).dayIdx).toBe(6); // Ahad 03:00 WIB
  });
  it("mengingatkan bila jam mulai tinggal <= 60 menit", () => {
    const r = dueReminders([kelas], now);
    expect(r).toHaveLength(1);
    expect(r[0]!.key).toBe("remind:c1:2026-11-10:19:30");
  });
  it("belum waktunya, sudah lewat, atau hari lain -> kosong", () => {
    expect(dueReminders([kelas], new Date("2026-11-10T10:00:00Z"))).toHaveLength(0); // 17:00 WIB
    expect(dueReminders([kelas], new Date("2026-11-10T12:31:00Z"))).toHaveLength(0); // 19:31 WIB
    expect(dueReminders([kelas], new Date("2026-11-11T11:45:00Z"))).toHaveLength(0); // Rabu
  });
  it("jadwal teks lama yang tidak terbaca tidak menghasilkan pengingat", () => {
    expect(dueReminders([{ ...kelas, schedule: "Selasa & Kamis, 19.30" }], now)).toHaveLength(0);
  });
  it("batas pengingat kedaluwarsa 10 menit setelah mulai", () => {
    expect(reminderExpired("2026-11-10", "19:30", new Date("2026-11-10T12:35:00Z"))).toBe(false); // 19:35
    expect(reminderExpired("2026-11-10", "19:30", new Date("2026-11-10T12:45:00Z"))).toBe(true); // 19:45
  });
  it("isi pengingat memuat jam dan Zoom", () => {
    const m = buildReminderMessage({ className: "Kelas Kecil", start: "19:30", zoomLink: "https://zoom.us/j/1" });
    expect(m).toContain("19:30");
    expect(m).toContain("https://zoom.us/j/1");
  });
});
