import { useState, useRef } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { 
  CalendarDays, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight 
} from "lucide-react";
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/kelas" className="text-sm font-medium text-primary hover:underline">
        ← Semua ilmu
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-primary">
        {data.subject.name}
      </h1>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {data.subject.bio}
      </p>

      {/* Tab Filter Pilihan Gender */}
      <div className="mt-5 flex flex-wrap gap-2 border-b pb-4">
        <button
          type="button"
          onClick={() => setSelectedGender("all")}
          className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition ${
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
          className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition ${
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
          className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition ${
            selectedGender === "akhwat"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          Akhwat (Perempuan)
        </button>
      </div>

      {/* Area Kartu Geser (Sliding Horizontal) */}
      <div className="mt-6">
        {filteredClasses.length > 0 ? (
          <ClassSlider classes={filteredClasses} enrollmentCounts={enrollmentCounts ?? {}} />
        ) : (
          <p className="text-muted-foreground text-center py-12 border rounded-2xl bg-card">
            Belum ada kelas yang sesuai dengan kategori ini.
          </p>
        )}
      </div>
    </div>
  );
}

function ClassSlider({
  classes,
  enrollmentCounts,
}: {
  classes: Tables<"classes">[];
  enrollmentCounts: Record<string, number>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const offset = direction === "left" ? -300 : 300;
    scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <div className="space-y-3">
      {/* Baris Judul & Tombol Panah Geser */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Pilihan Rombel Kelas ({classes.length} kelas)
          </p>
          <p className="text-xs text-muted-foreground">
            Geser kartu ke kanan untuk melihat rombel lainnya 👉
          </p>
        </div>

        {classes.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Geser ke kiri"
              className="rounded-full border bg-background p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground shadow-xs transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Geser ke kanan"
              className="rounded-full border bg-background p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground shadow-xs transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Kontainer Geser Horizontal (Tidak Menumpuk ke Bawah) */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {classes.map((c, idx) => {
          const enrolled = enrollmentCounts[c.id] ?? 0;
          const maxQuota = c.quota || 15;
          const isFull = enrolled >= maxQuota;
          const remaining = Math.max(0, maxQuota - enrolled);

          return (
            <div
              key={c.id}
              className={`min-w-[280px] sm:min-w-[310px] max-w-[320px] shrink-0 snap-center rounded-3xl border bg-card p-5 shadow-sm transition hover:shadow-md flex flex-col justify-between ${
                isFull ? "border-destructive/40 bg-muted/20" : "border-border"
              }`}
            >
              <div>
                {/* Header Kartu */}
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    Pilihan {idx + 1}
                  </span>
                  {(c as any).target_gender === "ikhwan" && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      Ikhwan
                    </span>
                  )}
                  {(c as any).target_gender === "akhwat" && (
                    <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                      Akhwat
                    </span>
                  )}
                  {(!(c as any).target_gender || (c as any).target_gender === "all") && (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      Umum
                    </span>
                  )}
                </div>

                {/* Nama Kelas */}
                <h3 className="mt-3 text-lg font-bold text-foreground leading-snug">
                  {c.name}
                </h3>
                <p className="mt-0.5 text-xs font-medium text-primary">
                  Level {c.level_number} · {c.level_label}
                </p>
                {c.tagline && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {c.tagline}
                  </p>
                )}

                {/* Jadwal & Kuota */}
                <div className="mt-4 space-y-1.5 rounded-xl border p-3 bg-muted/30 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5 font-medium text-foreground">
                    <CalendarDays className="h-3.5 w-3.5 text-primary" /> {c.schedule}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Kuota {maxQuota} santri
                  </p>
                </div>

                {/* Status Kuota */}
                <div className="mt-3">
                  {isFull ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs">
                      <p className="flex items-center gap-1 font-semibold text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" /> Kelas Penuh ({enrolled}/{maxQuota})
                      </p>
                      <p className="mt-0.5 text-[11px] text-destructive/80">
                        Geser ke kanan untuk memilih rombel lain 👉
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-2.5 text-xs">
                      <p className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Tersisa {remaining} kursi lagi
                      </p>
                      <p className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-500">
                        ({enrolled} dari {maxQuota} santri terdaftar)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Harga & Tombol Aksi */}
              <div className="mt-5 pt-3 border-t">
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-xs text-muted-foreground">Biaya belajar:</span>
                  <span className="font-display font-bold text-primary text-base">
                    {rupiah(c.price)}
                    <span className="text-xs font-normal text-muted-foreground">
                      /{packageUnit(c)}
                    </span>
                  </span>
                </div>

                {isFull ? (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-xl bg-muted py-2.5 text-center text-xs font-semibold text-muted-foreground cursor-not-allowed"
                  >
                    Kelas Sudah Penuh
                  </button>
                ) : (
                  <Link
                    to="/kelas/$slug"
                    params={{ slug: c.slug }}
                    className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-primary py-2.5 text-center text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm transition"
                  >
                    <span>Pilih Kelas Ini</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
