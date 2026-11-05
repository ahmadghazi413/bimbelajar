import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
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
  { value: "all", label: "Semua" },
  { value: "ikhwan", label: "Ikhwan (Laki-Laki)" },
  { value: "akhwat", label: "Akhwat (Perempuan)" },
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/kelas" className="text-sm font-medium text-primary hover:underline">
        ← Semua ilmu
      </Link>
      <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-primary">
        {data.subject.name}
      </h1>
      {data.subject.bio && (
        <p className="mt-2 text-muted-foreground leading-relaxed">{data.subject.bio}</p>
      )}

      {isTahsinPage && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-foreground">Pilih kelompok santri</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pilih kelas khusus Ikhwan atau Akhwat.
          </p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Pilih kelompok santri">
            {genderOptions.map((option) => {
              const isActive = selectedGender === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setSelectedGender(option.value)}
                  className={[
                    "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-foreground hover:bg-secondary",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="mt-8 text-xl font-bold text-foreground">Pilih Kelas</h2>
      {visibleClasses.length > 0 ? (
        <>
          <Carousel
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
                <CarouselPrevious className="-left-1 hidden h-9 w-9 sm:inline-flex" />
                <CarouselNext className="-right-1 hidden h-9 w-9 sm:inline-flex" />
              </>
            )}
          </Carousel>
          {visibleClasses.length > 1 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Geser ke kanan untuk melihat kelas lainnya →
            </p>
          )}
        </>
      ) : (
        <p className="mt-4 text-muted-foreground">
          Belum ada kelas untuk pilihan {genderOptions.find((option) => option.value === selectedGender)?.label.toLowerCase()}.
        </p>
      )}
    </div>
  );
}
