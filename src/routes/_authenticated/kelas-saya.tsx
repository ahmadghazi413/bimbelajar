import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Video as VideoIcon, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Page, StatusBadge } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";
import { SessionList } from "@/components/SessionList";

export const Route = createFileRoute("/_authenticated/kelas-saya")({
  head: () => ({ meta: [{ title: "Kelas Saya — Bimbelajar" }, { name: "description", content: "Kelas ngaji yang Anda ikuti, jadwal dan akses belajar Bimbelajar." }, { property: "og:title", content: "Kelas Saya — Bimbelajar" }, { property: "og:description", content: "Kelas ngaji yang Anda ikuti, jadwal dan akses belajar Bimbelajar." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: KelasSaya,
});

function KelasSaya() {
  const { userId } = Route.useRouteContext();
  const { data, isLoading } = useQuery({
    queryKey: ["kelas-saya", userId],
    queryFn: async () => {
      const { data: enr } = await supabase.from("enrollments").select("*, classes(*, class_sessions(*))")
        .eq("user_id", userId).neq("status", "rejected").order("created_at", { ascending: false });
      const { data: priv } = await supabase.from("class_private").select("*");
      return { enr: enr ?? [], priv: priv ?? [] };
    },
  });

  if (isLoading) return <Page title="Kelas Saya">Memuat...</Page>;
  const seen = new Set<string>();
  const list = (data?.enr ?? []).filter((e) => (seen.has(e.class_id) ? false : (seen.add(e.class_id), true)));

  return (
    <Page title="Kelas Saya">
      {list.length === 0 && (
        <div className="rounded-3xl border bg-card p-6 text-center">
          <p>Anda belum mengikuti kelas apa pun.</p>
          <Button asChild variant="hero" className="mt-4"><Link to="/kelas">Pilih Kelas</Link></Button>
        </div>
      )}
      <div className="space-y-6">
        {list.map((e) => {
          const c = e.classes!;
          const p = data!.priv.find((x) => x.class_id === e.class_id);
          return (
            <div key={e.id} className="rounded-3xl border bg-card p-6">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-2xl font-semibold text-primary">{c.name}</h2>
                <StatusBadge status={e.status} />
              </div>
              <p className="mt-2 flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" /> {c.schedule}</p>
              {e.status === "paid" ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {p?.whatsapp_link && <Button asChild variant="success" size="lg"><a href={p.whatsapp_link} target="_blank" rel="noreferrer"><MessageCircle /> Gabung Grup WhatsApp</a></Button>}
                    {p?.zoom_link && <Button asChild variant="hero" size="lg"><a href={p.zoom_link} target="_blank" rel="noreferrer"><VideoIcon /> Masuk Zoom</a></Button>}
                  </div>
                  <h3 className="mb-3 mt-6 text-lg font-semibold">Jadwal & materi sesi</h3>
                  <SessionList sessions={[...c.class_sessions].sort((a, b) => a.level - b.level || a.number - b.number)} />
                </>
              ) : (
                <div className="mt-4">
                  <p className="text-sm">Link grup dan Zoom akan muncul setelah pembayaran dikonfirmasi.</p>
                  <Button asChild variant="outline" className="mt-3"><Link to="/bayar/$slug" params={{ slug: c.slug }}>Lihat instruksi pembayaran</Link></Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Page>
  );
}
