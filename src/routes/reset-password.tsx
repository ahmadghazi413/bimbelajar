import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isRecoveryUrl } from "@/lib/auth-navigation";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Atur Password Baru — Bimbelajar" },
      { name: "description", content: "Buat password baru untuk akun Bimbelajar Anda." },
      { property: "og:title", content: "Atur Password Baru — Bimbelajar" },
      { property: "og:description", content: "Buat password baru untuk akun Anda." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const marker = Number(sessionStorage.getItem("password_recovery") || 0);
    const recovery = isRecoveryUrl(window.location.hash, window.location.search) || (marker > 0 && Date.now() - marker < 30 * 60 * 1000);
    supabase.auth.getUser().then(({ data, error }) => {
      setReady(recovery && !!data.user && !error);
      setChecking(false);
    });
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    sessionStorage.removeItem("password_recovery");
    toast.success("Password berhasil diganti.");
    navigate({ to: "/kelas-saya" });
  }
  if (checking) return <p className="p-10 text-center">Memeriksa link reset...</p>;
  if (!ready) return <div className="mx-auto max-w-md space-y-4 px-4 py-10"><h1 className="text-3xl font-semibold">Link reset tidak berlaku</h1><p>Link sudah kedaluwarsa atau tidak lengkap. Silakan minta link baru.</p><Button onClick={() => navigate({ to: "/auth" })}>Kembali ke Masuk</Button></div>;
  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 px-4 py-10">
      <h1 className="text-3xl font-semibold">Password baru</h1>
      <div className="space-y-2"><Label htmlFor="pw">Password baru</Label>
        <Input id="pw" type="password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} className="h-12" /></div>
      <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</Button>
    </form>
  );
}
