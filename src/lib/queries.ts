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
