// Pengirim WhatsApp lewat gateway Fonnte (server-only). Gateway ini tidak resmi dari WhatsApp:
// pakai nomor khusus, bukan nomor pribadi. Lihat WHATSAPP.md.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildAdminPaidMessage, buildReminderMessage, buildStudentPaidMessage, dueReminders, isGroupTarget,
  normalizePhone, packageText, reminderExpired, type ReminderClass,
} from "@/lib/wa-core";

const FONNTE_URL = "https://api.fonnte.com/send";
const MAX_ATTEMPTS = 5;
const BATCH = 10;

const db = () => supabaseAdmin as any;
const siteUrl = () => (process.env["SITE_URL"] ?? "https://padatilmu.web.id").replace(/\/+$/, "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fonnteSend(target: string, message: string): Promise<void> {
  const token = process.env["FONNTE_TOKEN"];
  if (!token) throw new Error("FONNTE_TOKEN belum diatur di server.");
  const form = new FormData();
  form.set("target", target);
  form.set("message", message);
  form.set("connectOnly", "true"); // gagal (bisa diulang) bila perangkat terputus, bukan antre diam-diam
  if (!isGroupTarget(target)) form.set("countryCode", "0"); // nomor sudah kita normalkan lengkap dengan kode negara
  const res = await fetch(FONNTE_URL, { method: "POST", headers: { Authorization: token }, body: form });
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok || !json || json.status !== true) {
    throw new Error(String(json?.reason ?? json?.detail ?? `HTTP ${res.status}`).slice(0, 200));
  }
}

type Composed = { target: string; message: string } | { skip: string };

async function composePaid(row: any): Promise<Composed> {
  const { data: enr } = await db().from("enrollments").select("*").eq("id", row.ref_id).maybeSingle();
  if (!enr) return { skip: "Pendaftaran tidak ditemukan." };
  if (enr.status !== "paid") return { skip: "Pembayaran tidak lagi berstatus lunas." };
  const [{ data: cls }, { data: prof }, { data: priv }] = await Promise.all([
    db().from("classes").select("name, schedule").eq("id", enr.class_id).maybeSingle(),
    db().from("profiles").select("full_name, phone").eq("id", enr.user_id).maybeSingle(),
    db().from("class_private").select("whatsapp_link").eq("class_id", enr.class_id).maybeSingle(),
  ]);
  const phone = normalizePhone(prof?.phone);
  const info = {
    studentName: (prof?.full_name ?? "").trim(),
    className: cls?.name ?? "Kelas",
    packageText: packageText(enr),
    amount: Number(enr.amount ?? 0),
    method: enr.method ?? "-",
    schedule: cls?.schedule ?? "",
    waGroupLink: (priv?.whatsapp_link ?? "").trim(),
    siteUrl: siteUrl(),
  };
  if (row.kind === "payment_student") {
    if (!phone) return { skip: "Nomor WA murid kosong atau tidak valid." };
    return { target: phone, message: buildStudentPaidMessage(info) };
  }
  const adminTarget = (process.env["WA_ADMIN_TARGET"] ?? "").trim();
  if (!adminTarget) return { skip: "WA_ADMIN_TARGET belum diatur." };
  return { target: adminTarget, message: buildAdminPaidMessage({ ...info, phone }) };
}

async function composeReminder(row: any, now: Date): Promise<Composed> {
  const p = row.payload ?? {};
  if (reminderExpired(p.date, p.start, now)) return { skip: "Terlambat: kelas sudah dimulai." };
  const [{ data: wa }, { data: cls }, { data: priv }] = await Promise.all([
    db().from("class_wa").select("group_id, reminder_enabled").eq("class_id", row.ref_id).maybeSingle(),
    db().from("classes").select("name, is_active").eq("id", row.ref_id).maybeSingle(),
    db().from("class_private").select("zoom_link").eq("class_id", row.ref_id).maybeSingle(),
  ]);
  const groupId = (wa?.group_id ?? "").trim();
  if (!wa?.reminder_enabled || !groupId) return { skip: "Pengingat nonaktif atau ID grup kosong." };
  if (!cls?.is_active) return { skip: "Kelas tidak aktif." };
  return { target: groupId, message: buildReminderMessage({ className: cls.name, start: p.start, zoomLink: (priv?.zoom_link ?? "").trim() }) };
}

async function enqueueReminders(now: Date) {
  const { data: waRows } = await db().from("class_wa").select("class_id, reminder_minutes").eq("reminder_enabled", true).neq("group_id", "");
  if (!waRows?.length) return 0;
  const { data: classes } = await db().from("classes").select("id, name, schedule").eq("is_active", true).in("id", waRows.map((r: any) => r.class_id));
  const minutes = new Map<string, number>(waRows.map((r: any) => [r.class_id, r.reminder_minutes]));
  const list: ReminderClass[] = (classes ?? []).map((c: any) => ({ id: c.id, name: c.name, schedule: c.schedule ?? "", reminder_minutes: minutes.get(c.id) ?? 60 }));
  const due = dueReminders(list, now);
  if (!due.length) return 0;
  // dedupe_key unik: cron yang jalan berulang tidak membuat pengingat ganda.
  await db().from("wa_outbox").upsert(
    due.map((d) => ({ kind: "class_reminder", dedupe_key: d.key, ref_id: d.classId, payload: { date: d.date, start: d.start } })),
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  );
  return due.length;
}

export async function runWaDispatch(now = new Date()) {
  const stats = { reminders_due: 0, sent: 0, skipped: 0, failed: 0, retry: 0 };
  // Pesan yang tersangkut "sending" >10 menit (proses mati di tengah jalan) dikembalikan ke antrean.
  await db().from("wa_outbox").update({ status: "pending" }).eq("status", "sending").lt("claimed_at", new Date(now.getTime() - 600_000).toISOString());
  stats.reminders_due = await enqueueReminders(now);

  const { data: rows } = await db().from("wa_outbox").select("*").eq("status", "pending").lte("send_after", now.toISOString())
    .order("created_at", { ascending: true }).limit(BATCH);

  let first = true;
  for (const row of rows ?? []) {
    // Klaim baris: hanya satu proses yang boleh mengirimnya.
    const { data: claimed } = await db().from("wa_outbox")
      .update({ status: "sending", claimed_at: now.toISOString(), attempts: row.attempts + 1 })
      .eq("id", row.id).eq("status", "pending").select("id");
    if (!claimed?.length) continue;
    try {
      const msg = row.kind === "class_reminder" ? await composeReminder(row, now) : await composePaid(row);
      if ("skip" in msg) {
        await db().from("wa_outbox").update({ status: "skipped", last_error: msg.skip }).eq("id", row.id);
        stats.skipped++;
        continue;
      }
      if (!first) await sleep(2000 + Math.random() * 2000); // jeda antar pesan agar tidak tampak seperti spam
      first = false;
      await fonnteSend(msg.target, msg.message);
      await db().from("wa_outbox").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", row.id);
      stats.sent++;
    } catch (e: any) {
      const attempts = row.attempts + 1;
      const final = attempts >= MAX_ATTEMPTS;
      await db().from("wa_outbox").update({
        status: final ? "failed" : "pending",
        last_error: String(e?.message ?? e).slice(0, 300),
        send_after: new Date(Date.now() + attempts * 5 * 60_000).toISOString(), // tunda 5, 10, 15 … menit
      }).eq("id", row.id);
      if (final) stats.failed++; else stats.retry++;
    }
  }
  return stats;
}
