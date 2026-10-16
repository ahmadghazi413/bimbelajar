import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { classesQuery } from "@/lib/queries";
import { ClassCard } from "@/components/ClassCard";

export const Route = createFileRoute("/kelas/")({
  head: () => ({
    meta: [
      { title: "Daftar Kelas Ngaji — Bimbelajar" },
      { name: "description", content: "Pilih Kelas Besar, Kelas Kecil, atau Privat. Lihat level, jadwal, kuota, dan harga." },
      { property: "og:title", content: "Daftar Kelas Ngaji — Bimbelajar" },
      { property: "og:description", content: "Kelas Besar, Kelas Kecil, dan Privat untuk belajar Al-Qur'an dari nol." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(classesQuery),
  component: KelasPage,
});

function KelasPage() {
  const { data } = useSuspenseQuery(classesQuery);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Pilih Kelas</h1>
      <p className="mt-2 text-muted-foreground">Semua kelas dimulai dari nol. Pilih yang paling nyaman.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {data.map((c) => <ClassCard key={c.id} c={c} />)}
      </div>
    </div>
  );
}
