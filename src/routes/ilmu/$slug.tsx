import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, GraduationCap, Users, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { subjectClassesQuery } from "@/lib/queries";
import { TeacherIdentity } from "@/components/TeacherIdentity";
import { Button } from "@/components/ui/button";
import { rupiah } from "@/lib/format";
import { startingPrice } from "@/lib/package-prices";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const genderOptions = [
  { value: "all", label: "Semua kelas", description: "Ikhwan dan akhwat", icon: UsersRound },
  { value: "ikhwan", label: "Ikhwan", description: "Laki-laki", icon: UsersRound },
  { value: "akhwat", label: "Akhwat", description: "Perempuan", icon: UsersRound },
] as const;

type GenderFilter = (typeof genderOptions)[number]["value"];
type ClassWithGender = { target_gender?: string | null };

function matchesTargetGender(classItem: ClassWithGender, filter: GenderFilter) {
  const gender = classItem.target_gender ?? "all";
  if (filter === "all") return true;
  return gender === filter || gender === "all";
}

export const Route = createFileRoute("/ilmu/$slug")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(subjectClassesQuery(params.slug));
    if (!d.subject) throw notFound();
    return { name: d.subject.name, bio: d.subject.bio };
  },
  head: ({ loaderData }) => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: loaderData ? `${loaderData.name} — PadatIlmu` : "Ilmu — PadatIlmu" },
      { name: "description", content: loaderData?.bio || "Pilih kelas dan level yang sesuai." },
      { property: "og:title", content: loaderData ? `${loaderData.name} — PadatIlmu` : "Ilmu — PadatIlmu" },
      { property: "og:description", content: loaderData?.bio || "Pilih kelas dan level yang sesuai." },
    ],
  }),
  notFoundComponent: () => <p className="p-10 text-center">Ilmu tidak ditemukan.</p>,
  component: IlmuPage,
});

function IlmuPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(subjectClassesQuery(slug));
  const [selectedGender, setSelectedGender] = useState<GenderFilter>("all");

  if (!data.subject) return null;

  const classes = data.classes.filter((c) => c.is_active !== false);
  const isTahsinPage = slug === "tahsin";
  const visibleClasses = isTahsinPage
    ? classes.filter((c) => matchesTargetGender(c as typeof c & ClassWithGender, selectedGender))
    : classes;
  const selectedOption = genderOptions.find((option) => option.value === selectedGender) ?? genderOptions[0];

  // Menggabungkan kelas rombel (Kelas A, B, C) dengan level & gender sama jadi 1 kartu program
  const groupedPrograms = useMemo(() => {
    const groups: Record<string, any[]> = {};

    for (const c of visibleClasses) {
      const key = c.level_number
        ? `lvl-${c.level_number}-${c.target_gender ?? "all"}`
        : `cls-${c.name.replace(/[\s\-_]+Kelas\s+[A-Za-z0-9]+$/i, "").trim()}-${c.target_gender ?? "all"}`;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(c);
    }

    return Object.values(groups).map((rombels) => {
      rombels.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99) || a.name.localeCompare(b.name));
      const primary = rombels[0];
      const cleanName = primary.name
        .replace(/[\s\-_]+Kelas\s+[A-Za-z0-9]+$/i, "")
        .trim();

      return {
        primaryClass: primary,
        rombels,
        rombelCount: rombels.length,
        cleanName: cleanName || primary.name,
      };
    });
  }, [visibleClasses]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <Link to="/kelas" className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/75">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Semua ilmu
      </Link>

      <header className="mt-5 max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-primary shadow-sm">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          Program belajar
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          {data.subject.name}
        </h1>
        {data.subject.bio && (
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{data.subject.bio}</p>
        )}
      </header>

      {isTahsinPage && (
        <section className="mt-8 rounded-3xl border bg-gradient-to-br from-card to-secondary/50 p-4 shadow-sm sm:mt-10 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UsersRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-foreground sm:text-xl">Pilih kelas sesuai kelompok</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Tampilkan kelas Ikhwan (laki-laki) atau Akhwat (perempuan).
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3" role="group" aria-label="Pilih kelompok santri">
            {genderOptions.map((option) => {
              const isActive = selectedGender === option.value;
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setSelectedGender(option.value)}
                  className={[
                    "group flex min-h-16 items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-soft"
                      : "border-border bg-background/80 text-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-sm",
                  ].join(" ")}
                >
                  <span className={[
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                    isActive ? "bg-primary-foreground/15" : "bg-secondary text-primary group-hover:bg-primary/10",
                  ].join(" ")}>
                    {isActive ? <Check className="h-5 w-5" aria-hidden="true" /> : <Icon className="h-5 w-5" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{option.label}</span>
                    <span className={[
                      "mt-0.5 block text-xs",
                      isActive ? "text-primary-foreground/80" : "text-muted-foreground",
                    ].join(" ")}>
                      {option.description}
                    </span>
                  </span>
                  <ArrowRight className={[
                    "h-4 w-4 shrink-0 transition-transform",
                    isActive ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-70",
                  ].join(" ")} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-9 sm:mt-10" aria-live="polite">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {isTahsinPage ? selectedOption.label : "Kelas tersedia"}
            </p>
            <h2 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">Pilih program belajar</h2>
          </div>
          {groupedPrograms.length > 0 && (
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {groupedPrograms.length} program
            </span>
          )}
        </div>

        {groupedPrograms.length > 0 ? (
          <>
            <Carousel
              key={`${slug}-${selectedGender}`}
              opts={{ align: "start", slidesToScroll: 1, containScroll: "trimSnaps" }}
              className="mt-4 px-0 sm:px-6"
            >
              <CarouselContent className="-ml-4">
                {groupedPrograms.map((group) => (
                  <CarouselItem key={group.primaryClass.id} className="basis-[88%] pl-4 sm:basis-1/2 lg:basis-1/3">
                    <div className="h-full [&>div]:h-full">
                      <ProgramCard group={group} />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {groupedPrograms.length > 1 && (
                <>
                  <CarouselPrevious aria-label="Program sebelumnya" className="-left-1 hidden h-9 w-9 sm:inline-flex" />
                  <CarouselNext aria-label="Program berikutnya" className="-right-1 hidden h-9 w-9 sm:inline-flex" />
                </>
              )}
            </Carousel>
            {groupedPrograms.length > 1 && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Geser ke samping untuk melihat program lainnya <span aria-hidden="true">→</span>
              </p>
            )}
          </>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed bg-card p-6 text-center sm:p-8">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-3 font-semibold text-foreground">Belum ada program untuk pilihan ini</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Silakan pilih kelompok lain atau cek kembali nanti.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function ProgramCard({
  group,
}: {
  group: { primaryClass: any; rombels: any[]; rombelCount: number; cleanName: string };
}) {
  const c = group.primaryClass;
  const rombelCount = group.rombelCount;
  const targetGender = c.target_gender;
  const genderLabel = targetGender === "ikhwan" ? "Ikhwan · Laki-laki" : targetGender === "akhwat" ? "Akhwat · Perempuan" : null;
  const start = startingPrice(c);
  const regularPrice = start?.normal ?? 0;
  const hasPromo = !!start?.hasPromo;
  const finalPrice = start?.final ?? 0;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="h-1.5 bg-gradient-to-r from-primary via-primary/70 to-primary/20" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-xl font-bold leading-snug text-primary sm:text-2xl">{group.cleanName}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {genderLabel && (
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  targetGender === "akhwat"
                    ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                    : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                }`}
              >
                {genderLabel}
              </span>
            )}
            {rombelCount > 1 && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                {rombelCount} Pilihan Jam
              </span>
            )}
          </div>
        </div>

        {c.tagline && <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground">{c.tagline}</p>}

        <div className="mt-4">
          {rombelCount > 1 ? (
            <div className="my-3 flex items-center gap-3 text-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <GraduationCap className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">Pengajar</p>
                <p className="font-semibold text-foreground">Sesuai jam belajar yang dipilih</p>
              </div>
            </div>
          ) : (
            <TeacherIdentity teacherId={c.teacher_id} />
          )}
        </div>

        <ul className="mt-5 space-y-3 border-t pt-4 text-sm">
          <li className="flex items-start gap-2.5 text-foreground/90">
            <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{c.levels_label || `Level ${c.level_number || 1} · ${c.level_label || "Umum"}`}</span>
          </li>
          <li className="flex items-start gap-2.5 text-foreground/90">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              {rombelCount > 1 ? (
                <strong className="font-semibold text-primary">Tersedia {rombelCount} pilihan waktu (Kelas A, B, dst.)</strong>
              ) : (
                c.schedule || "Jadwal belum ditentukan"
              )}
            </span>
          </li>
          <li className="flex items-center gap-2.5 text-foreground/90">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              {rombelCount > 1 ? `Kuota ~${c.quota || 15} santri per kelas` : `Kuota ${c.quota || 15} santri`}
            </span>
          </li>
        </ul>

        <div className="mt-auto pt-6">
          <p className="text-xs font-medium text-muted-foreground">Investasi belajar</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            {(c.price_prefix || (start && "Mulai")) && <span className="text-sm text-muted-foreground">{c.price_prefix || "Mulai"}</span>}
            {hasPromo ? (
              <>
                <span className="text-sm text-muted-foreground line-through">{rupiah(regularPrice)}</span>
                <span className="font-display text-2xl font-bold text-foreground sm:text-3xl">{rupiah(finalPrice)}</span>
              </>
            ) : (
              <span className="font-display text-2xl font-bold text-foreground sm:text-3xl">{rupiah(regularPrice)}</span>
            )}
            <span className="text-sm text-muted-foreground">/{start?.label ?? "paket"}</span>
          </div>
          <Button asChild className="mt-4 w-full rounded-xl font-semibold transition-transform group-hover:translate-y-0">
            <Link to="/kelas/$slug" params={{ slug: c.slug }}>
              {rombelCount > 1 ? "Pilih Jadwal & Daftar" : "Lihat detail kelas"}
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
