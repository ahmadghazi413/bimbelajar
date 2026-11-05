import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { subjectClassesQuery } from "@/lib/queries";
import { packageUnit, rupiah } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/ilmu/$slug")({
  loader: async ({ context, params }) => {
    const { subject } = await context.queryClient.ensureQueryData(subjectClassesQuery(params.slug));
    if (!subject) throw notFound();
    return { name: subject.name, bio: subject.bio };
  },
  head: ({ loaderData }) => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: loaderData ? `${loaderData.name} — Bimbelajar` : "Ilmu — Bimbelajar" },
      { name: "description", content: loaderData?.bio ?? "Pilih kelas dan level." },
      { property: "og:title", content: loaderData ? `${loaderData.name} — Bimbelajar` : "Ilmu — Bimbelajar" },
      { property: "og:description", content: loaderData?.bio ?? "Pilih kelas dan level." },
    ],
  }),
  notFoundComponent: () => <p className="p-10 text-center">Ilmu tidak ditemukan.</p>,
  component: IlmuPage,
});

function IlmuPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(subjectClassesQuery(slug));
  const [selectedGender, setSelectedGender] = useState<"all" | "ikhwan" | "akhwat">("all");

  const { data: enrollmentCounts } = useQuery({
    queryKey: ["class-enrollment-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_class_enrollment_counts" as any);
      if (error) return {};
      const map: Record<string, number> = {};
      for (const row of (data as any[]) || []) {
        map[row.class_id] = Number(row.enrolled_count ?? 0);
      }
      return map;
    },
  });

  if (!data.subject) return null;

  const filteredClasses = data.classes.filter((c) => {
    const g = (c as any).target_gender || "all";
    if (selectedGender === "all") return true;
    return g === selectedGender || g === "all";
  });

  const groups = new Map<string, Tables<"classes">[]>();
  for (const c of filteredClasses) {
    const arr = groups.get(c.name) ?? [];
    arr.push(c);
    groups.set(c.name, arr);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/kelas" className="text-sm text-primary">← Semua ilmu</Link>
      <h1 className="mt-3 text-4xl font-semibold text-primary">{data.subject.name}</h1>
      <p className="mt-2 leading-relaxed text-muted-foreground">{data.subject.bio}</p>

      {/* Tab Filter Pilihan Gender */}
      <div className="mt-6 flex flex-wrap gap-2 border-b pb-4">
        <button
          type="button"
          onClick={() => setSelectedGender("all")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            selectedGender === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          Semua Pilihan
        </button>
        <button
          type="button"
          onClick={() => setSelectedGender("ikhwan")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            selectedGender === "ikhwan"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          Ikhwan (Laki-Laki)
        </button>
        <button
          type="button"
          onClick={() => setSelectedGender("akhwat")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            selectedGender === "akhwat"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          Akhwat (Perempuan)
        </button>
      </div>

      <div className="mt-8 space-y-6">
        {[...groups.entries()].map(([name, levels]) => {
          const first = levels[0];
          if (!first) return null;

          return (
            <div key={name} className="rounded-3xl border bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-2xl font-semibold">{name}</h2>
                {(first as any).target_gender === "ikhwan" && (
                  <span className="rounded-full bg-blue-50 px-3 py-0.5 text-xs font-medium text-blue-700">
                    Khusus Ikhwan (Laki-Laki)
                  </span>
                )}
                {(first as any).target_gender === "akhwat" && (
                  <span className="rounded-full bg-rose-50 px-3 py-0.5 text-xs font-medium text-rose-700">
                    Khusus Akhwat (Perempuan)
                  </span>
                )}
              </div>

              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" /> {first.schedule}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" /> Kuota {first.quota || 15} santri
                </span>
              </p>

              <div className="mt-4 space-y-2">
                {levels.map((c) => {
                  const enrolled = enrollmentCounts?.[c.id] ?? 0;
                  const maxQuota = c.quota || 15;
                  const isFull = enrolled >= maxQuota;
                  const remaining = Math.max(0, maxQuota - enrolled);

                  return (
                    <Link
                      key={c.id}
                      to="/kelas/$slug"
                      params={{ slug: c.slug }}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border bg-background px-4 py-3 transition hover:border-primary ${
                        isFull ? "opacity-75 border-dashed" : ""
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">Level {c.level_number} · {c.level_label}</p>
                          {isFull ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                              <AlertCircle className="h-3 w-3" /> Kelas Penuh
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" /> Tersisa {remaining} kursi ({enrolled}/{maxQuota})
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{c.tagline}</p>
                      </div>

                      <p className="text-left sm:text-right font-display font-semibold text-primary">
                        {c.price_prefix && (
                          <span className="mr-1 text-xs font-normal text-muted-foreground">{c.price_prefix}</span>
                        )}
                        {rupiah(c.price)}
                        <span className="block text-xs font-normal text-muted-foreground">/{packageUnit(c)}</span>
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {groups.size === 0 && (
          <p className="text-muted-foreground text-center py-8">
            Belum ada kelas yang sesuai dengan kategori ini.
          </p>
        )}
      </div>
    </div>
  );
}
