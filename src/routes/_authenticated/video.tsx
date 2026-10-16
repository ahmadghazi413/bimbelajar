import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toEmbedUrl } from "@/lib/format";
import { Page } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/video")({
  head: () => ({ meta: [{ title: "Riwayat Video — Bimbelajar" }] }),
  component: VideoPage,
});

function VideoPage() {
  const { userId } = Route.useRouteContext();
  const [playing, setPlaying] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["videos", userId],
    queryFn: async () => {
      // RLS hanya mengembalikan rekaman dari kelas yang sudah lunas
      const { data } = await supabase.from("session_recordings")
        .select("video_url, session_id, class_sessions(level, number, title, description), classes(name)");
      return (data ?? []).sort((a, b) =>
        (a.classes?.name ?? "").localeCompare(b.classes?.name ?? "") ||
        a.class_sessions!.level - b.class_sessions!.level || a.class_sessions!.number - b.class_sessions!.number);
    },
  });

  if (isLoading) return <Page title="Riwayat Video">Memuat...</Page>;
  if (!data?.length)
    return (
      <Page title="Riwayat Video">
        <div className="rounded-3xl border bg-card p-6 text-center">
          <p>Belum ada rekaman. Rekaman tersedia untuk kelas yang sudah lunas.</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/kelas-saya">Kelas Saya</Link></Button>
        </div>
      </Page>
    );

  const groups = new Map<string, typeof data>();
  for (const r of data) {
    const k = `${r.classes?.name} · Level ${r.class_sessions?.level}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  return (
    <Page title="Riwayat Video" subtitle="Tonton ulang sesi yang sudah berlalu.">
      <div className="space-y-8">
        {[...groups].map(([k, items]) => (
          <section key={k}>
            <h2 className="mb-3 text-xl font-semibold text-primary">{k}</h2>
            <div className="space-y-3">
              {items.map((r) => {
                const embed = toEmbedUrl(r.video_url);
                const open = playing === r.session_id;
                return (
                  <div key={r.session_id} className="overflow-hidden rounded-2xl border bg-card">
                    <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setPlaying(open ? null : r.session_id)}>
                      <PlayCircle className="h-8 w-8 shrink-0 text-primary" />
                      <div>
                        <p className="font-medium">Sesi {r.class_sessions?.number}: {r.class_sessions?.title}</p>
                        <p className="text-sm text-muted-foreground">{r.class_sessions?.description}</p>
                      </div>
                    </button>
                    {open && (embed ? (
                      <div className="aspect-video w-full bg-foreground">
                        <iframe src={embed} title={r.class_sessions?.title} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
                      </div>
                    ) : (
                      <a href={r.video_url} target="_blank" rel="noreferrer" className="block p-4 text-primary underline">Buka video</a>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Page>
  );
}
