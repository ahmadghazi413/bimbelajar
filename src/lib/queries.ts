import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const classesQuery = queryOptions({
  queryKey: ["classes"],
  queryFn: async () => {
    const { data, error } = await supabase.from("classes").select("*").order("sort_order");
    if (error) throw error;
    return data;
  },
});

export const subjectsQuery = queryOptions({
  queryKey: ["subjects"],
  queryFn: async () => {
    const { data, error } = await supabase.from("subjects").select("*").order("sort_order");
    if (error) throw error;
    return data;
  },
});

export const subjectClassesQuery = (subjectSlug: string) =>
  queryOptions({
    queryKey: ["subject-classes", subjectSlug],
    queryFn: async () => {
      const { data: subject, error: e1 } = await supabase
        .from("subjects").select("*").eq("slug", subjectSlug).maybeSingle();
      if (e1) throw e1;
      if (!subject) return { subject: null, classes: [] };
      const { data: classes, error: e2 } = await supabase
        .from("classes").select("*").eq("subject_id", subject.id)
        .order("name").order("level_number");
      if (e2) throw e2;
      return { subject, classes: classes ?? [] };
    },
  });

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("settings").select("*");
    if (error) throw error;
    const map: Record<string, string> = {};
    for (const row of data ?? []) map[row.key] = row.value;
    return map;
  },
});

export const classDetailQuery = (slug: string) =>
  queryOptions({
    queryKey: ["class", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*, class_sessions(*)")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (data) data.class_sessions.sort((a, b) => a.level - b.level || a.number - b.number);
      return data;
    },
  });
