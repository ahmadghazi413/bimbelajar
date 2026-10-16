import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "masuk" | "daftar" | "lupa";
const safePath = (p: unknown) => (typeof p === "string" && p.startsWith("/") && !p.startsWith("//") ? p : "/kelas-saya");

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => (typeof s["redirect"] === "string" ? { redirect: s["redirect"] } : {}),
  head: () => ({
    meta: [
      { title: "Masuk atau Daftar — Bimbelajar" },
      { name: "description", content: "Masuk atau buat akun Bimbelajar untuk mulai belajar ngaji online." },
      { property: "og:title", content: "Masuk atau Daftar — Bimbelajar" },
      { property: "og:description", content: "Buat akun untuk mulai belajar ngaji online." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const target = safePath(redirect);
  const { session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("masuk");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: target, replace: true });
  }, [session, target, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "masuk") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "daftar") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + target, data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) toast.success("Cek email Anda untuk konfirmasi akun, lalu masuk.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        toast.success("Link reset password sudah dikirim ke email Anda.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      toast.error(msg.includes("Invalid login") ? "Email atau password salah." : msg);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (redirect) sessionStorage.setItem("after_login", target);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Gagal masuk dengan Google.");
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("after_login");
    if (session && saved) { sessionStorage.removeItem("after_login"); navigate({ to: safePath(saved), replace: true }); }
  }, [session, navigate]);

  const title = { masuk: "Assalamu'alaikum, silakan masuk", daftar: "Buat akun baru", lupa: "Lupa password" }[mode];

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "daftar" && (
          <div className="space-y-2"><Label htmlFor="name">Nama lengkap</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="h-12" /></div>
        )}
        <div className="space-y-2"><Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" /></div>
        {mode !== "lupa" && (
          <div className="space-y-2"><Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" /></div>
        )}
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
          {mode === "masuk" ? "Masuk" : mode === "daftar" ? "Daftar" : "Kirim link reset"}
        </Button>
      </form>
      {mode !== "lupa" && (
        <>
          <div className="my-5 text-center text-sm text-muted-foreground">atau</div>
          <Button variant="outline" size="lg" className="w-full" onClick={google}>Lanjut dengan Google</Button>
        </>
      )}
      <div className="mt-6 space-y-2 text-center text-sm">
        {mode === "masuk" && (<>
          <button className="text-primary" onClick={() => setMode("lupa")}>Lupa password?</button>
          <p>Belum punya akun? <button className="font-semibold text-primary" onClick={() => setMode("daftar")}>Daftar</button></p>
        </>)}
        {mode !== "masuk" && <button className="text-primary" onClick={() => setMode("masuk")}>← Kembali ke Masuk</button>}
      </div>
    </div>
  );
}
