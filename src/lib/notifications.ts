import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { tanggal } from "@/lib/format";

export type AppNotification = {
  key: string;
  kind: "today" | "expiring" | "expired" | "sessions" | "announcement";
  title: string;
  body?: string;
  date?: string;
};

export type EnrollmentRow = {
  id: string;
  class_id: string;
  paid_at?: string | null;
  starts_at?: string | null;
  package_type?: string | null;
  package_weeks?: number | null;
  sessions_total?: number | null;
  sessions_used?: number | null;
  classes?: { name: string; slug: string; schedule: string } | null;
};

type Announcement = { id: string; title: string; body: string; created_at: string };

const DAY_MS = 86_400_000;

/** Tanggal paket bulanan berakhir. Paket per sesi tidak punya tanggal berakhir (null). */
export function packageEnd(e: { paid_at?: string | null; starts_at?: string | null; package_type?: string | null; package_weeks?: number | null }): Date | null {
  const start = e.starts_at ?? e.paid_at;
  if (!start || e.package_type === "session") return null;
  const end = new Date(start);
  const weeks = e.package_weeks && e.package_weeks > 0 ? e.package_weeks : 4;
  if (weeks >= 4) end.setMonth(end.getMonth() + 1);
  else end.setDate(end.getDate() + weeks * 7);
  return end;
}

export function daysLeft(end: Date, now = new Date()): number {
  return Math.ceil((end.getTime() - now.getTime()) / DAY_MS);
}

const DAY_WORDS: Record<string, number> = {
  senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, sabtu: 6, ahad: 0,
};
const DAY_PATTERN = "senin|selasa|rabu|kamis|jum'?at|sabtu|ahad";

/** Baca nama hari dari teks jadwal, mis. "Selasa & Kamis, 19.30" -> [2, 4]. 0 = Ahad. */
export function classDays(schedule: string): number[] {
  const text = (schedule || "").toLowerCase();
  const days = new Set<number>();

  const range = new RegExp(`(${DAY_PATTERN})\\s*(?:-|–|—|s/d|sd|sampai)\\s*(${DAY_PATTERN})`, "g");
  for (const m of text.matchAll(range)) {
    let d = DAY_WORDS[m[1]];
    const end = DAY_WORDS[m[2]];
    if (d === undefined || end === undefined) continue;
    for (let i = 0; i < 7; i++) {
      days.add(d);
      if (d === end) break;
      d = (d + 1) % 7;
    }
  }

  const words = text.replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);
  words.forEach((w, i) => {
    if (w in DAY_WORDS) days.add(DAY_WORDS[w]);
    if (w === "minggu") {
      const prev = words[i - 1] ?? "";
      const asWeek = /^\d+$/.test(prev) || ["setiap", "tiap", "per", "satu", "dua", "tiga", "empat"].includes(prev);
      if (!asWeek) days.add(0);
    }
  });

  if (days.size === 0 && /(setiap|tiap)\s+hari|harian|every\s*day/.test(text)) {
    for (let i = 0; i < 7; i++) days.add(i);
  }
  return [...days];
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function buildNotifications(
  enrollments: EnrollmentRow[],
  announcements: Announcement[],
  now = new Date(),
): AppNotification[] {
  const warnings: AppNotification[] = [];
  const today: AppNotification[] = [];

  const latest = new Map<string, EnrollmentRow>();
  for (const e of enrollments) {
    const prev = latest.get(e.class_id);
    if (!prev || (e.starts_at ?? e.paid_at ?? "") > (prev.starts_at ?? prev.paid_at ?? "")) latest.set(e.class_id, e);
  }

  for (const e of latest.values()) {
    const name = e.classes?.name ?? "Kelas";
    let active = true;

    const end = packageEnd(e);
    if (end) {
      const d = daysLeft(end, now);
      if (d <= 0) {
        active = false;
        warnings.push({
          key: `expired:${e.id}`,
          kind: "expired",
          title: `Paket ${name} sudah habis`,
          body: "Akses Zoom, grup, dan video ditutup. Perpanjang paket di menu Kelas Saya.",
        });
      } else if (d <= 7) {
        warnings.push({
          key: `expiring:${e.id}:${d}`,
          kind: "expiring",
          title: `Paket ${name} tinggal ${d} hari lagi`,
          body: `Berlaku sampai ${tanggal(end.toISOString())}. Segera perpanjang di menu Kelas Saya agar belajar tidak terhenti.`,
        });
      }
    } else if (e.package_type === "session") {
      const used = e.sessions_used ?? 0;
      const sisa = (e.sessions_total ?? 0) - used;
      if (used > 0 && sisa <= 0) {
        active = false;
        warnings.push({ key: `sessions-out:${e.id}`, kind: "sessions", title: `Sesi ${name} sudah habis`, body: "Hubungi admin untuk menambah paket sesi." });
      } else if (used > 0 && sisa <= 2) {
        warnings.push({ key: `sessions-low:${e.id}:${sisa}`, kind: "sessions", title: `Sisa ${sisa} sesi di ${name}`, body: "Yuk perpanjang paket sesi agar belajar tidak terhenti." });
      }
    }

    const schedule = e.classes?.schedule ?? "";
    if (active && classDays(schedule).includes(now.getDay())) {
      today.push({
        key: `today:${e.class_id}:${ymd(now)}`,
        kind: "today",
        title: `Hari ini ada kelas: ${name}`,
        body: schedule,
      });
    }
  }

  const info: AppNotification[] = announcements.map((a) => ({
    key: `ann:${a.id}`,
    kind: "announcement",
    title: a.title,
    body: a.body,
    date: a.created_at,
  }));

  return [...warnings, ...today, ...info];
}

export function useNotifications() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const enrollments = useQuery({
    queryKey: ["notif-enrollments", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, classes(name, slug, schedule)")
        .eq("user_id", userId!)
        .eq("status", "paid");
      if (error) return [] as EnrollmentRow[];
      return (data ?? []) as unknown as EnrollmentRow[];
    },
  });

  const announcements = useQuery({
    queryKey: ["notif-announcements"],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return [] as Announcement[];
      return (data ?? []) as Announcement[];
    },
  });

  const storeKey = `notif-seen:${userId ?? ""}`;
  const [seen, setSeen] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      setSeen(new Set(JSON.parse(localStorage.getItem(storeKey) || "[]")));
    } catch {
      setSeen(new Set());
    }
  }, [storeKey]);

  const items = useMemo(
    () => buildNotifications(enrollments.data ?? [], announcements.data ?? []),
    [enrollments.data, announcements.data],
  );
  const unread = items.filter((i) => !seen.has(i.key)).length;

  function markAllSeen() {
    const next = new Set(items.map((i) => i.key));
    setSeen(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify([...next]));
    } catch {
      /* penyimpanan browser tidak tersedia */
    }
  }

  return { items, unread, seen, markAllSeen };
}
