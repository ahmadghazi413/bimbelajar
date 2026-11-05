import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { subjectClassesQuery } from "@/lib/queries";
import { ClassCard } from "@/components/ClassCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

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
  if (!data.subject) return null;

  const classes = data.classes.filter((c) => c.is_active !== false);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/kelas" className="text-sm font-medium text-primary hover:underline">
        ← Semua ilmu
      </Link>
      <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-primary">
        {data.subject.name}
      </h1>
      {data.subject.bio && (
        <p className="mt-2 text-muted-foreground leading-relaxed">{data.subject.bio}</p>
      )}

      <h2 className="mt-8 text-xl font-bold text-foreground">Pilih Kelas</h2>
