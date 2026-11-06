import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Panel admin memakai akses longgar karena beberapa tabel (session_*, announcements) tidak ada di tipe otomatis.
export const sb = supabase as any;

export function slugify(value: string, prefix = "") {
  const s = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return prefix ? `${prefix}-${s}` : s;
}

export function useSubjects() {
  return useQuery({
    queryKey: ["admin-subjects"],
    queryFn: async () => {
      const { data, error } = await sb.from("subjects").select("*").order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useClasses() {
  return useQuery({
    queryKey: ["admin-classes"],
    queryFn: async () => {
      const { data, error } = await sb.from("classes").select("*").order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function toDateInput(iso?: string | null) {
  return iso ? new Date(iso).toISOString().slice(0, 16) : "";
}

export function safeFileName(name: string) {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? "bin";
  return `${crypto.randomUUID()}.${ext}`;
}

export const field = "h-11 w-full rounded-lg border bg-card px-3 text-sm";
