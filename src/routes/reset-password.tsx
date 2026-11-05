import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isRecoveryUrl } from "@/lib/auth-navigation";
import { passwordChangeSchema, newPasswordSchema, PASSWORD_HINT } from "@/lib/account-validation";
import { changeAccountPassword } from "@/lib/accounts.functions";
import { settingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Ganti Password — PadatIlmu" },
    { name: "description", content: "Ganti password akun PadatIlmu dengan verifikasi password lama atau hubungi admin." },
    { property: "og:title", content: "Ganti Password — PadatIlmu" },
    { property: "og:description", content: "Ganti password akun PadatIlmu dengan aman." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Reset,
});

function Reset() {
  const changePassword = useServerFn(changeAccountPassword);
  const { data: settings } = useQuery(settingsQuery);
  const [email, setEmail] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const adminPhone = settings?.["admin_whatsapp"]?.replace(/[^0-9]/g, "");

  useEffect(() => {
    // Existing emailed recovery links remain usable; new requests use the old-password form.
    const marker = Number(sessionStorage.getItem("password_recovery") || 0);
    if (!isRecoveryUrl(window.location.hash, window.location.search) && !(marker > 0 && Date.now() - marker < 30 * 60 * 1000)) return;
    supabase.auth.getUser().then(({ data }) => { if (data.user) { setRecovery(true); setEmail(data.user.email || ""); } });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    const parsed = recovery ? newPasswordSchema.safeParse(newPassword) : passwordChangeSchema.safeParse({ email, oldPassword, newPassword, confirmation });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Periksa data Anda."); return; }
    if (newPassword !== confirmation) { setError("Konfirmasi password baru tidak sama."); return; }
    setBusy(true);
    try {
      if (recovery) {
        const { error: recoveryError } = await supabase.auth.updateUser({ password: newPassword });
        if (recoveryError) throw recoveryError;
      } else {
        const result = await changePassword({ data: { email, oldPassword, newPassword, confirmation } });
        if (result.error) throw new Error(result.error);
      }
      sessionStorage.removeItem("password_recovery");
      setOldPassword(""); setNewPassword(""); setConfirmation("");
      setSuccess(true);
      toast.success("Password berhasil diganti.");
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal mengganti password. Coba lagi."); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-md space-y-5 px-4 py-10">
    <h1 className="text-3xl font-semibold">{success ? "Password berhasil diganti" : "Ganti password"}</h1>
    {success ? <Button asChild variant="hero" className="w-full"><Link to="/auth">Kembali ke Masuk</Link></Button> : <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">{recovery ? "Masukkan password baru untuk akun Anda." : "Password lama diperlukan untuk memastikan akun milik Anda. Jika benar-benar lupa, hubungi admin."}</p>
      <div className="space-y-2"><Label htmlFor="reset-email">Email akun</Label><Input id="reset-email" type="email" autoComplete="email" required maxLength={255} value={email} disabled={recovery} onChange={(e) => setEmail(e.target.value)} className="h-12" /></div>
      {!recovery && <div className="space-y-2"><Label htmlFor="old-password">Password lama</Label><Input id="old-password" type="password" autoComplete="current-password" required maxLength={4096} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="h-12" /></div>}
      <div className="space-y-2"><Label htmlFor="new-password">Password baru</Label><Input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={64} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} aria-describedby="reset-hint" className="h-12" /><p id="reset-hint" className="text-sm text-muted-foreground">{PASSWORD_HINT}</p></div>
      <div className="space-y-2"><Label htmlFor="confirm-password">Konfirmasi password baru</Label><Input id="confirm-password" type="password" autoComplete="new-password" required maxLength={64} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="h-12" /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>{busy ? "Menyimpan..." : "Konfirmasi Reset Password"}</Button>
    </form>}
    <Button asChild variant="outline" className="w-full">{adminPhone ? <a href={`https://wa.me/${adminPhone}?text=${encodeURIComponent("Assalamu'alaikum, saya perlu bantuan mengganti password akun PadatIlmu.")}`} target="_blank" rel="noreferrer"><MessageCircle />Hubungi Admin</a> : <Link to="/kontak"><MessageCircle />Hubungi Admin</Link>}</Button>
    {!success && <Button asChild variant="link" className="w-full"><Link to="/auth">Kembali ke Masuk</Link></Button>}
  </div>;
}