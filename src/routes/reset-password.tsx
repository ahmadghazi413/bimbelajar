import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
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
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { toast.error(error.message); return; }
    toast.success("Password berhasil diganti.");
    navigate({ to: "/kelas-saya" });
  }
  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 px-4 py-10">
      <h1 className="text-3xl font-semibold">Password baru</h1>
      <div className="space-y-2"><Label htmlFor="pw">Password baru</Label>
        <Input id="pw" type="password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} className="h-12" /></div>
      <Button type="submit" variant="hero" size="lg" className="w-full">Simpan</Button>
    </form>
  );
}
