import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, Check, UsersRound } from "lucide-react";
import { useState } from "react";
import { subjectClassesQuery } from "@/lib/queries";
import { ClassCard } from "@/components/ClassCard";
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
      { title: loaderData ? `${loaderData.name} — Bimbelajar` : "Ilmu — Bimbelajar" },
      { name: "description", content: loaderData?.bio || "Pilih kelas dan level yang sesuai." },
      { property: "og:title", content: loaderData ? `${loaderData.name} — Bimbelajar` : "Ilmu — Bimbelajar" },
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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{isTahsinPage ? selectedOption.label : "Kelas tersedia"}</p>
            <h2 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">Pilih kelas</h2>
          </div>
          {visibleClasses.length > 0 && (
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {visibleClasses.length} {visibleClasses.length === 1 ? "kelas" : "kelas"}
            </span>
          )}
        </div>

        {visibleClasses.length > 0 ? (
          <>
            <Carousel
              key={`${slug}-${selectedGender}`}
              opts={{ align: "start", slidesToScroll: 1, containScroll: "trimSnaps" }}
              className="mt-4 px-0 sm:px-6"
            >
              <CarouselContent className="-ml-4">
                {visibleClasses.map((c) => (
                  <CarouselItem key={c.id} className="basis-[88%] pl-4 sm:basis-1/2 lg:basis-1/3">
                    <div className="h-full [&>div]:h-full">
                      <ClassCard c={c} />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {visibleClasses.length > 1 && (
                <>
                  <CarouselPrevious aria-label="Kelas sebelumnya" className="-left-1 hidden h-9 w-9 sm:inline-flex" />
                  <CarouselNext aria-label="Kelas berikutnya" className="-right-1 hidden h-9 w-9 sm:inline-flex" />
                </>
              )}
            </Carousel>
            {visibleClasses.length > 1 && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Geser ke samping untuk melihat kelas lainnya <span aria-hidden="true">→</span>
              </p>
            )}
          </>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed bg-card p-6 text-center sm:p-8">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-3 font-semibold text-foreground">Belum ada kelas untuk pilihan ini</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Silakan pilih kelompok lain atau cek kembali nanti.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
