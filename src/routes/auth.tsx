import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { registerAccount } from "@/lib/accounts.functions";
import { signupSchema, PASSWORD_HINT } from "@/lib/account-validation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeAuthPath, isRecoveryUrl } from "@/lib/auth-navigation";

type Mode = "masuk" | "daftar";
const safePath = safeAuthPath;

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => (typeof s["redirect"] === "string" ? { redirect: s["redirect"] } : {}),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Masuk atau Daftar — PadatIlmu" },
      { name: "description", content: "Masuk atau daftar akun PadatIlmu dengan email dan password." },
      { property: "og:title", content: "Masuk atau Daftar — PadatIlmu" },
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
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const register = useServerFn(registerAccount);

  useEffect(() => {
    if (!session || isRecoveryUrl(window.location.hash, window.location.search)) return;
    const recovery = Number(sessionStorage.getItem("password_recovery") || 0);
    if (recovery > 0 && Date.now() - recovery < 30 * 60 * 1000) { navigate({ to: "/reset-password", replace: true }); return; }
    const saved = sessionStorage.getItem("after_login");
    sessionStorage.removeItem("after_login");
    navigate({ to: saved ? safePath(saved) : target, replace: true });
  }, [session, target, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "masuk") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const parsed = signupSchema.safeParse({ name, email, password, phone, origin: window.location.origin });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Periksa data pendaftaran.");
        const result = await register({ data: parsed.data });
        if (result.error) throw new Error(result.error);
        if (result.session) {
          const { error } = await supabase.auth.setSession(result.session);
          if (error) throw error;
        } else toast.success("Cek email Anda untuk konfirmasi akun, lalu masuk.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      toast.error(msg.includes("Invalid login") ? "Email atau password salah." : msg);
    } finally {
      setBusy(false);
    }
  }

  const title = { masuk: "Assalamu'alaikum, silakan masuk", daftar: "Buat akun baru" }[mode];

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "daftar" && (
          <div className="space-y-2"><Label htmlFor="name">Nama lengkap</Label>
            <Input id="name" autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="h-12" /></div>
        )}
        <div className="space-y-2"><Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" maxLength={255} required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" /></div>
        <div className="space-y-2"><Label htmlFor="pw">Password</Label>
          <Input id="pw" type="password" autoComplete={mode === "daftar" ? "new-password" : "current-password"} required minLength={mode === "daftar" ? 8 : 1} maxLength={mode === "daftar" ? 64 : 4096} pattern={mode === "daftar" ? "(?=.*[a-zA-Z])(?=.*[0-9]).{8,64}" : undefined} aria-describedby={mode === "daftar" ? "password-hint" : undefined} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
          {mode === "daftar" && <p id="password-hint" className="text-sm text-muted-foreground">{PASSWORD_HINT}</p>}
        </div>
        {mode === "daftar" && <div className="space-y-2"><Label htmlFor="phone">No. WhatsApp</Label><Input id="phone" type="tel" autoComplete="tel" inputMode="tel" required maxLength={16} pattern="\+?[0-9]{9,15}" placeholder="081234567890" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12" /></div>}
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
          {busy ? "Memproses..." : mode === "masuk" ? "Masuk" : "Daftar"}
        </Button>
      </form>
      <div className="mt-6 space-y-2 text-center text-sm">
        {mode === "masuk" && (<>
          <Button asChild variant="link"><Link to="/reset-password">Lupa password?</Link></Button>
          <p>Belum punya akun? <Button variant="link" disabled={busy} onClick={() => setMode("daftar")}>Daftar</Button></p>
        </>)}
        {mode !== "masuk" && <Button variant="link" disabled={busy} onClick={() => setMode("masuk")}>← Kembali ke Masuk</Button>}
      </div>
    </div>
  );
}
