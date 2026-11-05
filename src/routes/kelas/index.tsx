import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight, GraduationCap, Sparkles } from "lucide-react";
import { subjectsQuery } from "@/lib/queries";

export const Route = createFileRoute("/kelas/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const subjects = data.filter((subject) => subject.is_active !== false);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-primary shadow-sm">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Belajar dengan terarah
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-primary sm:text-4xl">Pilih ilmu</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Mulai dari memilih bidang yang ingin dipelajari. Setelah itu, temukan kelas dan level yang paling sesuai.
        </p>
      </header>

      {subjects.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2">
          {subjects.map((subject) => (
            <Link
              key={subject.id}
              to="/ilmu/$slug"
              params={{ slug: subject.slug }}
              className="group flex min-h-40 items-start gap-4 rounded-3xl border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <BookOpen className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-display text-xl font-bold text-foreground sm:text-2xl">
                  {subject.name}
                </span>
                <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">
                  {subject.bio || "Lihat kelas yang tersedia dan pilih program belajar yang sesuai."}
                </span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Lihat kelas <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </span>
              <GraduationCap className="mt-1 hidden h-5 w-5 shrink-0 text-primary/50 sm:block" aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-3xl border border-dashed bg-card p-8 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-semibold">Belum ada ilmu yang tersedia</p>
          <p className="mt-1 text-sm text-muted-foreground">Silakan cek kembali nanti.</p>
        </div>
      )}
    </main>
  );
}
