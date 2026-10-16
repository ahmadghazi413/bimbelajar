import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Page } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({ meta: [{ title: "Profil — Bimbelajar" }] }),
  component: Profil,
});

function Profil() {
  const { userId } = Route.useRouteContext();
  const { session } = useAuth();
  const { data } = useQuery({
    queryKey: ["profil", userId],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()).data,
  });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  useEffect(() => { if (data) { setName(data.full_name ?? ""); setPhone(data.phone ?? ""); } }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("profiles").update({ full_name: name, phone }).eq("id", userId);
    error ? toast.error(error.message) : toast.success("Profil disimpan.");
  }

  return (
    <Page title="Profil">
      <form onSubmit={save} className="space-y-4 rounded-3xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">{session?.user.email}</p>
        <div className="space-y-2"><Label htmlFor="n">Nama lengkap</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} className="h-12" /></div>
        <div className="space-y-2"><Label htmlFor="p">No. WhatsApp</Label><Input id="p" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12" placeholder="08xxxxxxxxxx" /></div>
        <Button type="submit" variant="hero" className="w-full">Simpan</Button>
      </form>
      <div className="mt-6 rounded-3xl bg-secondary p-6 text-secondary-foreground">
        <h2 className="text-xl font-semibold">Progres belajar</h2>
        <p className="mt-2">Level saat ini: <b>{data?.current_level ? `Level ${data.current_level}` : "Belum dinilai"}</b></p>
        {data?.test_notes && <p className="mt-1">Catatan tes: {data.test_notes}</p>}
      </div>
    </Page>
  );
}
