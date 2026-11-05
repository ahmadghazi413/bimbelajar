import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, Target, Users } from "lucide-react";
import { classDetailQuery } from "@/lib/queries";
import { packageUnit, rupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { TeacherIdentity } from "@/components/TeacherIdentity";

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
  component: Detail,
});

function Detail() {
  const { slug } = Route.useParams();
  const { data: c } = useSuspenseQuery(classDetailQuery(slug));
  if (!c) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-28">
      <Link to="/kelas" className="text-sm font-medium text-primary hover:underline">
        ← Semua ilmu
      </Link>
      <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-primary">
        {c.name}
      </h1>
      <div className="mt-2 flex items-center gap-2">
        <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
          Level {c.level_number} · {c.level_label}
        </span>
        {(c as any).target_gender === "ikhwan" && (
          <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Khusus Ikhwan (Laki-Laki)
          </span>
        )}
        {(c as any).target_gender === "akhwat" && (
          <span className="inline-block rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
            Khusus Akhwat (Perempuan)
          </span>
        )}
      </div>

      <p className="mt-3 text-base text-muted-foreground">{c.tagline}</p>
      
      <div className="mt-4">
        <TeacherIdentity teacherId={c.teacher_id} />
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl bg-secondary p-5 text-secondary-foreground">
        <p className="flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 text-primary" /> {c.schedule}
        </p>
        <p className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-primary" /> Kuota {c.quota || 15} santri
        </p>
        <p className="font-display text-2xl font-bold text-primary mt-1">
          {c.price_prefix && <span className="text-xs font-normal text-muted-foreground mr-1">{c.price_prefix}</span>}
          {rupiah(c.price)}{" "}
          <span className="font-sans text-xs font-normal text-muted-foreground">
            /{packageUnit(c)}
          </span>
        </p>
      </div>

      {c.description && (
        <>
          <h2 className="mt-8 text-xl font-bold text-foreground">Tentang kelas</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {c.description}
          </p>
        </>
      )}

      {c.goals && (
        <>
          <h2 className="mt-6 flex items-center gap-2 text-xl font-bold text-foreground">
            <Target className="h-5 w-5 text-primary" /> Tujuan Pembelajaran
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {c.goals}
          </p>
        </>
      )}

      {c.advantages && c.advantages.trim() && (
        <>
          <h2 className="mb-2 mt-8 text-xl font-bold text-foreground">Keunggulan</h2>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {c.advantages}
          </p>
        </>
      )}

      {/* Tombol Melayang di Bawah Layar */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-4 backdrop-blur z-20">
        <div className="mx-auto max-w-3xl">
          <Button asChild variant="hero" size="lg" className="w-full text-base">
            <Link to="/bayar/$slug" params={{ slug: c.slug }}>
              Daftar dan Bayar Sekarang
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
