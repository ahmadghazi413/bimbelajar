import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, Target, Users } from "lucide-react";
import { classDetailQuery } from "@/lib/queries";
import { rupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { SessionList } from "@/components/SessionList";

export const Route = createFileRoute("/kelas/$slug")({
  loader: async ({ context, params }) => {
    const c = await context.queryClient.ensureQueryData(classDetailQuery(params.slug));
    if (!c) throw notFound();
    return { name: c.name, tagline: c.tagline };
  },
  head: ({ loaderData }) => ({
    meta: [
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
      <Link to="/kelas" className="text-sm text-primary">← Semua kelas</Link>
      <h1 className="mt-3 text-4xl font-semibold text-primary">{c.name}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{c.tagline}</p>

      <div className="mt-6 grid gap-3 rounded-2xl bg-secondary p-5 text-secondary-foreground">
        <p className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> {c.schedule}</p>
        <p className="flex items-center gap-2"><Users className="h-5 w-5" /> Kuota {c.quota} orang · {c.levels_label}</p>
        <p className="font-display text-2xl font-semibold">
          {c.price_prefix} {rupiah(c.price)} <span className="font-sans text-sm font-normal">/bulan</span>
        </p>
      </div>

      <h2 className="mt-8 text-2xl font-semibold">Tentang kelas</h2>
      <p className="mt-2 leading-relaxed">{c.description}</p>
      <h2 className="mt-6 flex items-center gap-2 text-2xl font-semibold"><Target className="h-6 w-6 text-primary" /> Tujuan</h2>
      <p className="mt-2 leading-relaxed">{c.goals}</p>

      <h2 className="mb-4 mt-8 text-2xl font-semibold">Daftar Sesi</h2>
      <SessionList sessions={c.class_sessions} />

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Button asChild variant="hero" size="lg" className="w-full">
            <Link to="/bayar/$slug" params={{ slug: c.slug }}>Daftar dan Bayar</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
