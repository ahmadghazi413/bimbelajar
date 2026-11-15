import { rupiah } from "./format";

export type ReminderClass = {
  id: string;
  name: string;
  schedule: string;
  reminder_minutes: number;
};

export function isGroupTarget(target: string): boolean {
  return target.includes("@g.us") || target.includes("-") || target.length > 20;
}

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  } else if (digits.startsWith("8")) {
    digits = "62" + digits;
  }
  if (digits.length < 8 || digits.length > 16) return null;
  return digits;
}

export function packageText(enr: { package_type?: string; sessions_total?: number; package_weeks?: number }): string {
  if (enr.package_type === "session") {
    return `${enr.sessions_total ?? 1} sesi`;
  }
  const weeks = enr.package_weeks ?? 4;
  const months = Math.max(1, Math.round(weeks / 4));
  return `${months} bulan`;
}

export type PaidInfo = {
  studentName: string;
  className: string;
  packageText: string;
  amount: number;
  method: string;
  schedule: string;
  waGroupLink: string;
  siteUrl: string;
  phone?: string | null;
};

export function buildStudentPaidMessage(info: PaidInfo): string {
  const groupSection = info.waGroupLink
    ? `\nSilakan bergabung ke grup WhatsApp kelas melalui tautan berikut:\n${info.waGroupLink}\n`
    : `\nTautan grup WhatsApp kelas akan segera dikirim oleh admin.\n`;

  return (
    `*Konfirmasi Pembayaran — PadatIlmu*\n\n` +
    `Alhamdulillah, pembayaran pendaftaran kelas Anda telah kami terima:\n\n` +
    `• Nama: *${info.studentName}*\n` +
    `• Kelas: *${info.className}*\n` +
    `• Paket: *${info.packageText}*\n` +
    `• Jadwal: *${info.schedule || "-"}*\n` +
    `• Total: *${rupiah(info.amount)}*\n` +
    groupSection +
    `\nAnda juga dapat melihat detail kelas dan link pertemuan di menu Kelas Saya:\n` +
    `${info.siteUrl}/kelas-saya\n\n` +
    `Jazakumullahu khairan.`
  );
}

export function buildAdminPaidMessage(info: PaidInfo): string {
  const phoneWarning = !info.phone ? `\n⚠️ PERINGATAN: Nomor WA murid TIDAK terkirim karena kosong/tidak valid!` : "";
  const groupWarning = !info.waGroupLink ? `\n⚠️ PERINGATAN: Link grup WhatsApp kelas belum diisi di database!` : "";

  return (
    `*Pendaftaran Baru Lunas — PadatIlmu*\n\n` +
    `• Murid: *${info.studentName}*\n` +
    `• No. WA: ${info.phone ? `https://wa.me/${info.phone}` : "Tidak ada"}\n` +
    `• Kelas: *${info.className}*\n` +
    `• Paket: *${info.packageText}*\n` +
    `• Total: *${rupiah(info.amount)}* (${info.method})\n` +
    phoneWarning +
    groupWarning
  );
}

export function buildReminderMessage(info: { className: string; start: string; zoomLink: string }): string {
  const zoomText = info.zoomLink ? `\nLink Zoom / Pertemuan:\n${info.zoomLink}\n` : "";
  return (
    `*Pengingat Sesi Belajar — PadatIlmu*\n\n` +
    `Sesi kelas *${info.className}* akan dimulai pukul *${info.start} WIB*.\n` +
    zoomText +
    `\nMohon bersiap tepat waktu. Jazakumullahu khairan.`
  );
}

export function wibParts(d: Date): { dayIdx: number; minutes: number; date: string } {
  const wibTime = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const year = wibTime.getUTCFullYear();
  const month = String(wibTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wibTime.getUTCDate()).padStart(2, "0");
  const hours = wibTime.getUTCHours();
  const mins = wibTime.getUTCMinutes();
  const utcDay = wibTime.getUTCDay();
  const dayIdx = (utcDay + 6) % 7;
  return {
    dayIdx,
    minutes: hours * 60 + mins,
    date: `${year}-${month}-${day}`,
  };
}

const DAY_MAP: Record<string, number> = {
  senin: 0,
  selasa: 1,
  rabu: 2,
  kamis: 3,
  jumat: 4,
  "jum'at": 4,
  sabtu: 5,
  ahad: 6,
  minggu: 6,
};

export function parseScheduleSlots(schedule: string): Array<{ dayIdx: number; startMinutes: number; startStr: string }> {
  if (!schedule) return [];
  const results: Array<{ dayIdx: number; startMinutes: number; startStr: string }> = [];
  const parts = schedule.split(",");
  for (const part of parts) {
    const match = part.trim().match(/^([A-Za-z'’]+)\s+(\d{1,2})[:.](\d{2})/);
    if (!match) continue;
    const dayName = match[1].toLowerCase();
    const dayIdx = DAY_MAP[dayName];
    if (dayIdx === undefined) continue;
    const h = parseInt(match[2], 10);
    const m = parseInt(match[3], 10);
    const startMinutes = h * 60 + m;
    const startStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    results.push({ dayIdx, startMinutes, startStr });
  }
  return results;
}

export function dueReminders(
  classes: ReminderClass[],
  now: Date
): Array<{ key: string; class_id: string; date: string; start: string }> {
  const { dayIdx, minutes: nowMinutes, date } = wibParts(now);
  const out: Array<{ key: string; class_id: string; date: string; start: string }> = [];

  for (const cls of classes) {
    const slots = parseScheduleSlots(cls.schedule);
    for (const slot of slots) {
      if (slot.dayIdx !== dayIdx) continue;
      const diff = slot.startMinutes - nowMinutes;
      const windowMin = cls.reminder_minutes || 60;
      if (diff >= 0 && diff <= windowMin) {
        out.push({
          key: `remind:${cls.id}:${date}:${slot.startStr}`,
          class_id: cls.id,
          date,
          start: slot.startStr,
        });
      }
    }
  }

  return out;
}

export function reminderExpired(date: string, start: string, now: Date): boolean {
  const [h, m] = start.split(":").map(Number);
  const startWibMs = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+07:00`).getTime();
  const diffMinutes = (now.getTime() - startWibMs) / (60 * 1000);
  return diffMinutes > 10;
}
wa
