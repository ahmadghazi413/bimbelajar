import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu, BookOpen, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/queries";

export function SiteHeader() {
  const { session, isAdmin } = useAuth();
  const { data: settings } = useQuery(settingsQuery);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const siteName = settings?.["site_name"]?.trim() || "PadatIlmu";
  const logoUrl = settings?.["logo_url"] || "";

  async function logout() {
    setOpen(false);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const item = "block rounded-xl px-4 py-3 text-base font-medium hover:bg-secondary";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
<Link to="/" className="flex items-center gap-2.5">
  {logoUrl ? (
    <img
      src={logoUrl}
      alt={siteName}
      className="h-8 max-h-9 w-auto max-w-[140px] object-contain rounded"
    />
  ) : (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
      <BookOpen className="h-5 w-5" />
    </span>
  )}
    <span className="font-display text-xl font-bold tracking-tight text-primary">
    {siteName}
  </span>
</Link>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle className="font-display text-primary flex items-center gap-2">
                {logoUrl && (
                  <img src={logoUrl} alt={siteName} className="h-6 w-auto object-contain rounded" />
                )}
                {siteName}
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-4 space-y-1" onClick={() => setOpen(false)}>
              <Link to="/" className={item}>Beranda</Link>
              <Link to="/kelas" className={item}>Daftar Kelas</Link>
              {session ? (
                <>
                  <Link to="/kelas-saya" className={item}>Kelas Saya</Link>
                  <Link to="/video" className={item}>Riwayat Video</Link>
                  <Link to="/pembayaran" className={item}>Riwayat Pembayaran</Link>
                  <Link to="/profil" className={item}>Profil</Link>
                  {isAdmin && <Link to="/admin" className={`${item} text-primary font-semibold`}>Panel Admin</Link>}
                </>
              ) : (
                <Link to="/auth" className={item}>Masuk / Daftar</Link>
              )}
              <a
                href={settings?.["admin_whatsapp"] ? `https://wa.me/${settings["admin_whatsapp"]}` : "https://wa.me/62881022392900"}
                target="_blank"
                rel="noreferrer"
                className={`${item} flex items-center gap-2`}
              >
                <MessageCircle className="h-5 w-5 text-primary" /> Bantuan Admin
              </a>
            </nav>
            {session && (
              <Button variant="outline" className="mt-6 w-full" onClick={logout}>
                Keluar
              </Button>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
