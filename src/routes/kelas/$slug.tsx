import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Check, Clock3, GraduationCap, Target, Users } from "lucide-react";
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
  const targetGender = (c as typeof c & { target_gender?: string | null }).target_gender;
  const genderLabel = targetGender === "ikhwan" ? "Khusus Ikhwan (Laki-laki)" : targetGender === "akhwat" ? "Khusus Akhwat (Perempuan)" : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 pb-32 sm:px-6 sm:py-10">
      <Link to="/kelas" className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/75">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Semua ilmu
      </Link>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
              Level {c.level_number} · {c.level_label}
            </span>
            {genderLabel && (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${targetGender === "akhwat" ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"}`}>
                {genderLabel}
              </span>
            )}
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-primary sm:text-4xl">{c.name}</h1>
          {c.tagline && <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">{c.tagline}</p>}
          <div className="mt-4"><TeacherIdentity teacherId={c.teacher_id} /></div>
        </div>

        <aside className="rounded-3xl border bg-card p-5 shadow-sm lg:sticky lg:top-24">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Investasi belajar</p>
          <p className="mt-2 font-display text-3xl font-bold text-primary">
            {c.price_prefix && <span className="mr-1 text-xs font-medium text-muted-foreground">{c.price_prefix}</span>}
            {rupiah(c.price)}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">per {packageUnit(c)}</p>
          <div className="my-4 border-t" />
          <div className="space-y-3 text-sm">
            <p className="flex items-start gap-2.5"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{c.schedule}</span></p>
            <p className="flex items-center gap-2.5"><Users className="h-4 w-4 shrink-0 text-primary" /><span>Kuota {c.quota || 15} santri</span></p>
            <p className="flex items-center gap-2.5"><Clock3 className="h-4 w-4 shrink-0 text-primary" /><span>{c.levels_label}</span></p>
          </div>
          <Button asChild variant="hero" size="lg" className="mt-5 w-full text-base">
            <Link to="/bayar/$slug" params={{ slug: c.slug }}>Daftar kelas</Link>
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">Pendaftaran aman dan mudah</p>
        </aside>
      </div>

      <div className="mt-8 grid gap-6 border-t pt-7 sm:mt-10 sm:pt-9">
        {c.description && (
          <section>
            <h2 className="text-xl font-bold text-foreground">Tentang kelas</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">{c.description}</p>
          </section>
        )}
        {c.goals && (
          <section>
            <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><Target className="h-5 w-5 text-primary" /> Tujuan pembelajaran</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">{c.goals}</p>
          </section>
        )}
        {c.advantages && c.advantages.trim() && (
          <section>
            <h2 className="text-xl font-bold text-foreground">Keunggulan kelas</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {c.advantages.split(/\n|,/).map((advantage) => advantage.trim()).filter(Boolean).map((advantage, index) => (
                <p key={`${index}-${advantage}`} className="flex items-start gap-2 rounded-2xl border bg-card p-3 text-sm leading-relaxed">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {advantage}
                </p>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 p-3 backdrop-blur-xl sm:hidden">
        <Button asChild variant="hero" size="lg" className="w-full text-base">
          <Link to="/bayar/$slug" params={{ slug: c.slug }}>Daftar dan bayar · {rupiah(c.price)}</Link>
        </Button>
      </div>
    </main>
  );
}
