import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Clock3, Users, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TeacherIdentity } from "@/components/TeacherIdentity";
import { rupiah } from "@/lib/format";
import { getPackagePrice, packageCounts, packageLabel, startingPrice, unitWeeks } from "@/lib/package-prices";
import { classDetailQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/kelas/$slug")({
  loader: async ({ context, params }) => {
    const c = await context.queryClient.ensureQueryData(classDetailQuery(params.slug));
    if (!c) throw notFound();
    return { name: c.name, tagline: c.tagline };
  },
  head: ({ loaderData }) => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: loaderData ? `${loaderData.name} — Bimbelajar` : "Kelas — Bimbelajar" },
      { name: "description", content: loaderData?.tagline ?? "Detail kelas ngaji online." },
      { property: "og:title", content: loaderData ? `${loaderData.name} — Bimbelajar` : "Kelas — Bimbelajar" },
      { property: "og:description", content: loaderData?.tagline ?? "Detail kelas ngaji online." },
    ],
  }),
  notFoundComponent: () => <p className="p-10 text-center">Kelas tidak ditemukan.</p>,
  component: ClassDetailContainer,
});

function ClassDetailContainer() {
  const { slug } = Route.useParams();
  const { data: c } = useSuspenseQuery(classDetailQuery(slug));
  if (!c) return null;
  return <ClassDetailPage c={c} />;
}

export function ClassDetailPage({ c }: { c: any }) {
  // Ambil rombel / jadwal lain dalam program dan kelompok (gender) yang sama
  const { data: siblings } = useQuery({
    queryKey: ["sibling-classes", c.subject_id, c.level_number, c.target_gender],
    queryFn: async () => {
      let query = supabase
        .from("classes")
        .select("*")
        .eq("subject_id", c.subject_id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (c.level_number) {
        query = query.eq("level_number", c.level_number);
      }
      if (c.target_gender && c.target_gender !== "all") {
        query = query.eq("target_gender", c.target_gender);
      }
      const { data } = await query;
      return data ?? [];
    },
  });

  // Ambil jumlah santri terdaftar real-time untuk cek kuota rombel
  const { data: enrollmentCounts } = useQuery({
    queryKey: ["class-enrollment-counts"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_class_enrollment_counts");
      const map: Record<string, number> = {};
      for (const r of (data as any) ?? []) map[r.class_id] = r.enrolled_count;
      return map;
    },
  });

  const rombelList = (siblings && siblings.length > 0) ? siblings : [c];
  const [selectedId, setSelectedId] = useState<string>(c.id);

  // Kelas/rombel yang sedang dipilih murid
  const activeClass = rombelList.find((item) => item.id === selectedId) ?? c;

  const targetGender = activeClass.target_gender;
  const genderLabel = targetGender === "ikhwan" ? "Ikhwan · Laki-laki" : targetGender === "akhwat" ? "Akhwat · Perempuan" : null;
  const start = startingPrice(activeClass);
  const regularPrice = start?.normal ?? 0;
  const hasPromo = !!start?.hasPromo;
  const finalPrice = start?.final ?? 0;
  const allowedKinds: ("monthly" | "session")[] = (activeClass.allowed_packages?.length ? activeClass.allowed_packages : ["monthly"]);
  const priceRows = allowedKinds.flatMap((kind) => {
    const counts = packageCounts(activeClass, kind);
    return (counts.length ? counts : [1]).map((count) => ({ key: `${kind}-${count}`, label: packageLabel(kind, count, unitWeeks(activeClass)), ...getPackagePrice(activeClass, kind, count) }));
  }).filter((r) => r.final > 0);

  const activeEnrolled = enrollmentCounts?.[activeClass.id] ?? 0;
  const activeQuota = activeClass.quota || 15;
  const activeRemaining = Math.max(0, activeQuota - activeEnrolled);
  const isActiveFull = activeRemaining <= 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <Link to="/kelas" className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/75">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Kembali ke katalog
      </Link>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
              Level {activeClass.level_number} · {activeClass.level_label}
            </span>
            {genderLabel && (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${targetGender === "akhwat" ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"}`}>
                {genderLabel}
              </span>
            )}
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-primary sm:text-4xl">{activeClass.name}</h1>
          {activeClass.tagline && <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">{activeClass.tagline}</p>}
          <div className="mt-4"><TeacherIdentity teacherId={activeClass.teacher_id} /></div>

          {/* KOTAK PILIHAN JADWAL / ROMBEL */}
          {rombelList.length > 1 && (
            <section className="mt-8 rounded-3xl border bg-card p-5 sm:p-6 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-foreground sm:text-xl">
                    Pilih Jadwal Belajar (Rombel)
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tersedia {rombelList.length} pilihan jadwal. Klik waktu yang paling pas untuk Anda:
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {rombelList.map((item) => {
                  const isSelected = item.id === activeClass.id;
                  const enrolled = enrollmentCounts?.[item.id] ?? 0;
                  const quota = item.quota || 15;
                  const remaining = Math.max(0, quota - enrolled);
                  const isFull = remaining <= 0;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={isFull}
                      onClick={() => setSelectedId(item.id)}
                      className={[
                        "w-full text-left rounded-2xl border p-4 transition-all duration-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                          : isFull
                            ? "border-dashed opacity-60 bg-muted/30 cursor-not-allowed"
                            : "hover:border-primary/40 hover:bg-secondary/20 bg-background"
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-3">
                        <span className={[
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                          isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 bg-background"
                        ].join(" ")}>
                          {isSelected && <span className="h-2 w-2 rounded-full bg-current" />}
                        </span>
                        <div>
                          <p className="font-semibold text-foreground flex items-center gap-2">
                            <span>{item.name}</span>
                            {isSelected && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                Dipilih
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-sm font-medium text-primary flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4 shrink-0" />
                            <span>{item.schedule || "Jadwal belum ditentukan"}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:self-center pl-8 sm:pl-0">
                        {isFull ? (
                          <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                            Kelas Penuh ({enrolled}/{quota})
                          </span>
                        ) : (
                          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                            Tersisa {remaining} kursi ({enrolled}/{quota})
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {activeClass.description && (
            <section className="mt-8">
              <h2 className="text-xl font-bold text-foreground">Tentang kelas ini</h2>
              <div className="mt-3 leading-relaxed text-muted-foreground whitespace-pre-line">
                {activeClass.description}
              </div>
            </section>
          )}
        </div>

        {/* SIDEBAR INVESTASI & DAFTAR */}
        <aside className="rounded-3xl border bg-card p-5 shadow-sm lg:sticky lg:top-24">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Investasi belajar</p>
          <p className="mt-2 font-display text-3xl font-bold text-primary">
            {activeClass.price_prefix && <span className="mr-1 text-xs font-medium text-muted-foreground">{activeClass.price_prefix}</span>}
            {hasPromo ? (
              <>
                <span className="mr-2 text-base font-medium text-muted-foreground line-through">{rupiah(regularPrice)}</span>
                <span>{rupiah(finalPrice)}</span>
              </>
            ) : (
              <span>{rupiah(regularPrice)}</span>
            )}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">mulai dari paket {start?.label ?? ""}</p>

          {priceRows.length > 1 && (
            <ul className="mt-3 space-y-1.5 rounded-2xl bg-secondary/40 p-3 text-sm">
              {priceRows.map((r) => (
                <li key={r.key} className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-semibold text-foreground">
                    {r.hasPromo && <span className="mr-1.5 text-xs font-normal text-muted-foreground line-through">{rupiah(r.normal)}</span>}
                    {rupiah(r.final)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="my-4 border-t" />

          <div className="space-y-3 text-sm">
            <p className="flex items-start gap-2.5">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{activeClass.schedule || "Jadwal belum ditentukan"}</span>
            </p>
            <p className="flex items-center gap-2.5">
              <Users className="h-4 w-4 shrink-0 text-primary" />
              <span>
                Kuota {activeQuota} santri {activeRemaining > 0 ? `(sisa ${activeRemaining} kursi)` : "(Penuh)"}
              </span>
            </p>
            <p className="flex items-center gap-2.5">
              <Clock3 className="h-4 w-4 shrink-0 text-primary" />
              <span>Level {activeClass.level_number} · {activeClass.level_label}</span>
            </p>
          </div>

          <Button
            asChild={!isActiveFull}
            disabled={isActiveFull}
            variant="hero"
            size="lg"
            className="mt-5 w-full text-base font-semibold"
          >
            {isActiveFull ? (
              <span>Kelas Penuh — Pilih Jadwal Lain</span>
            ) : (
              <Link to="/bayar/$slug" params={{ slug: activeClass.slug }}>
                Daftar kelas ini
              </Link>
            )}
          </Button>
        </aside>
      </div>
    </div>
  );
}
