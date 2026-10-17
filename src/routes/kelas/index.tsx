import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight } from "lucide-react";
import { subjectsQuery } from "@/lib/queries";

export const Route = createFileRoute("/kelas/")({
  head: () => ({
    meta: [
      { title: "Pilih Ilmu & Kelas — Bimbelajar" },
      { name: "description", content: "Pilih ilmu yang ingin dipelajari, lalu pilih kelas dan level yang sesuai." },
      { property: "og:title", content: "Pilih Ilmu & Kelas — Bimbelajar" },
      { property: "og:description", content: "Pilih ilmu yang ingin dipelajari, lalu pilih kelas dan level yang sesuai." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(subjectsQuery),
  component: KelasPage,
});

function KelasPage() {
  const { data } = useSuspenseQuery(subjectsQuery);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Pilih Ilmu</h1>
      <p className="mt-2 text-muted-foreground">Mulai dari memilih ilmu yang ingin Anda pelajari.</p>
      <div className="mt-8 space-y-4">
        {data.map((s) => (
          <Link key={s.id} to="/ilmu/$slug" params={{ slug: s.slug }}
            className="flex items-start gap-4 rounded-3xl border bg-card p-6 shadow-sm transition hover:border-primary">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
              <BookOpen className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-primary">{s.name}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.bio}</p>
            </div>
            <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        ))}
        {data.length === 0 && <p className="text-muted-foreground">Belum ada ilmu yang tersedia.</p>}
      </div>
    </div>
  );
}
