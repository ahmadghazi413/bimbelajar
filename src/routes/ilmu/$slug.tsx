import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, Users } from "lucide-react";
import { subjectClassesQuery } from "@/lib/queries";
import { packageUnit, rupiah } from "@/lib/format";
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
  if (!data.subject) return null;

  const groups = new Map<string, Tables<"classes">[]>();
  for (const c of data.classes) {
    const arr = groups.get(c.name) ?? [];
    arr.push(c);
    groups.set(c.name, arr);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/kelas" className="text-sm text-primary">← Semua ilmu</Link>
      <h1 className="mt-3 text-4xl font-semibold text-primary">{data.subject.name}</h1>
      <p className="mt-2 leading-relaxed text-muted-foreground">{data.subject.bio}</p>

      <div className="mt-8 space-y-6">
        {[...groups.entries()].map(([name, levels]) => {
          const first = levels[0];
          if (!first) return null;
          return (
          <div key={name} className="rounded-3xl border bg-card p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">{name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {first.schedule}</span>
              <span className="flex items-center gap-1"><Users className="h-4 w-4" /> Kuota {first.quota} orang</span>
            </p>
            <div className="mt-4 space-y-2">
              {levels.map((c) => (
                <Link key={c.id} to="/kelas/$slug" params={{ slug: c.slug }}
                  className="flex items-center justify-between rounded-2xl border bg-background px-4 py-3 transition hover:border-primary">
                  <div>
                    <p className="font-semibold">Level {c.level_number} · {c.level_label}</p>
                    <p className="text-sm text-muted-foreground">{c.tagline}</p>
                  </div>
                  <p className="text-right font-display font-semibold text-primary">
                    {c.price_prefix && <span className="mr-1 text-xs font-normal text-muted-foreground">{c.price_prefix}</span>}
                    {rupiah(c.price)}
                    <span className="block text-xs font-normal text-muted-foreground">/{packageUnit(c)}</span>
                  </p>
                </Link>
              ))}
            </div>
          </div>
                       
      );
    })}
 

        {groups.size === 0 && <p className="text-muted-foreground">Belum ada kelas untuk ilmu ini.</p>}
      </div>
    </div>
  );
}
