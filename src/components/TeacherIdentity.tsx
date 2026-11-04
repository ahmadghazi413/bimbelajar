import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const publicTeachersQuery = queryOptions({
  queryKey: ["public-teachers"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("public_teachers");
    if (error) throw error;
    return Promise.all((data ?? []).map(async (t) => {
      const result = t.photo_path ? await supabase.storage.from("teacher-photos").createSignedUrl(t.photo_path, 3600) : null;
      return { ...t, photoUrl: result?.data?.signedUrl };
    }));
  },
  staleTime: 600_000,
});
export function TeacherIdentity({ teacherId }: { teacherId?: string | null }) {
  const { data } = useQuery(publicTeachersQuery);
  const teacher = data?.find((t) => t.id === teacherId);
  if (!teacher) return null;
  return <div className="my-3 flex items-center gap-3 text-sm">
    {teacher.photoUrl && <img src={teacher.photoUrl} alt={teacher.name ?? "Pengajar"} className="h-12 w-12 shrink-0 rounded-full object-cover" />}
    <div><p className="text-xs text-muted-foreground">Pengajar</p><p className="font-semibold">{teacher.name}</p></div>
  </div>;
}