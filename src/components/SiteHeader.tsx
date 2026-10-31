import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu, BookOpen, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/queries";
import { NotificationBell } from "@/components/NotificationBell";

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

  const item = "block rounded-xl px-4 py-3 text-base font-medium transition hover:bg-secondary";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        {/* SISI KIRI: Tombol Burger Menu + Logo */}
        <div className="flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu" className="-ml-2">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle className="font-display text-primary flex items-center gap-2 text-left">
                  {logoUrl ? (
                    <img src={logoUrl} alt={siteName} className="h-7 w-auto object-contain rounded" />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded bg-primary text-primary-foreground">
                      <BookOpen className="h-4 w-4" />
                    </span>
                  )}
                  {siteName}
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-6 space-y-1.5" onClick={() => setOpen(false)}>
                <Link to="/" className={item}>Beranda</Link>
                <Link to={session ? "/kelas-saya" : "/auth"} className={item}>Kelas Saya</Link>
                <Link to={session ? "/pembayaran" : "/auth"} className={item}>Riwayat Pembayaran</Link>
                <Link to={session ? "/profil" : "/auth"} className={item}>Profil</Link>
                {isAdmin && (
                  <Link to="/admin" className={`${item} text-primary font-semibold bg-primary/10`}>
                    Panel Admin
                  </Link>
                )}
                <a
                  href={settings?.["admin_whatsapp"] ? `https://wa.me/${settings["admin_whatsapp"]}` : "https://wa.me/62881022392900"}
                  target="_blank"
                  rel="noreferrer"
                  className={`${item} flex items-center gap-2`}
                >
                  <MessageCircle className="h-4 w-4 text-primary" /> Tanya Admin
                </a>
                {!session && (
                  <Link to="/auth" className={`${item} text-primary font-semibold`}>
                    Masuk / Daftar
                  </Link>
                )}
              </nav>
              {session && (
                <div className="mt-8 pt-4 border-t">
                  <Button variant="outline" className="w-full" onClick={logout}>
                    Keluar
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex items-center gap-2">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={siteName}
                className="h-8 max-h-9 w-auto max-w-[130px] object-contain rounded"
              />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <BookOpen className="h-4 w-4" />
              </span>
            )}
            <span className="font-display text-lg font-bold tracking-tight text-primary hidden sm:inline">
              {siteName}
            </span>
          </Link>
        </div>

        {/* SISI KANAN: Sapaan atau Lonceng Notifikasi */}
        <div className="flex items-center gap-2">
          {session ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-primary hidden xs:inline">
                Hai Ilmuwan!
              </span>
              <NotificationBell />
            </div>
          ) : (
            <Button asChild size="sm" variant="default" className="text-xs h-8 px-3">
              <Link to="/auth">Masuk</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
