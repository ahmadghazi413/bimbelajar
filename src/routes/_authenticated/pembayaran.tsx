import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rupiah, tanggal } from "@/lib/format";
import { Page, StatusBadge } from "@/components/PageTitle";

export const Route = createFileRoute("/_authenticated/pembayaran")({
  head: () => ({ meta: [{ title: "Riwayat Pembayaran — Bimbelajar" }, { name: "description", content: "Status dan riwayat pembayaran kelas Bimbelajar." }, { property: "og:title", content: "Riwayat Pembayaran — Bimbelajar" }, { property: "og:description", content: "Status dan riwayat pembayaran kelas Bimbelajar." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Riwayat,
});

function Riwayat() {
  const { userId } = Route.useRouteContext();
  const { data, isLoading } = useQuery({
    queryKey: ["pembayaran", userId],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments").select("*, classes(name)").eq("user_id", userId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <Page title="Riwayat Pembayaran">
      {isLoading ? "Memuat..." : data?.length === 0 ? <p className="text-muted-foreground">Belum ada pembayaran.</p> : (
        <div className="space-y-3">
          {data!.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
              <div>
                <p className="font-semibold">{p.classes?.name}</p>
                <p className="text-sm text-muted-foreground">{tanggal(p.created_at)} · {p.method}</p>
                <p className="font-display text-lg">{rupiah(p.amount)}</p>
              </div>
              <StatusBadge status={p.status} />
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
