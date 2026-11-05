import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Download, Menu, MessageCircle } from "lucide-react";
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
  const teacherList: { email: string }[] = (() => {
    try {
      return settings?.["teacher_list"] ? JSON.parse(settings["teacher_list"]) : [];
    } catch {
      return [];
    }
  })();
  const userEmail = session?.user?.email?.toLowerCase();
  const isTeacher = teacherList.some((teacher) => teacher.email?.toLowerCase() === userEmail);

  async function logout() {
    setOpen(false);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const item = "flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary hover:text-primary";
  const logo = logoUrl ? (
    <img src={logoUrl} alt="" className="h-9 w-auto max-w-[130px] object-contain" />
  ) : (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
      <BookOpen className="h-5 w-5" aria-hidden="true" />
    </span>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Buka menu" className="shrink-0 lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[min(20rem,85vw)] flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-left font-display text-primary">
                  {logo}
                  <span className="truncate">{siteName}</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex-1 space-y-1" aria-label="Navigasi utama" onClick={() => setOpen(false)}>
                <Link to="/" className={item}>Beranda</Link>
                <Link to="/kelas" className={item}>Pilih Kelas</Link>
                <Link to={session ? "/kelas-saya" : "/auth"} className={item}>Kelas Saya</Link>
                <Link to={session ? "/pembayaran" : "/auth"} className={item}>Riwayat Pembayaran</Link>
                <Link to={session ? "/profil" : "/auth"} className={item}>Profil</Link>
                {settings?.["apk_url"] && (
                  <a href={settings["apk_url"]} download={settings["apk_name"] || "PadatIlmu.apk"} target="_blank" rel="noreferrer" className={`${item} text-primary`}>
                    <Download className="h-4 w-4" /> Unduh aplikasi
                  </a>
                )}
                <div className="my-3 border-t" />
                <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informasi</p>
                <Link to="/faq" className={item}>FAQ</Link>
                <Link to="/refund" className={item}>Kebijakan Refund</Link>
                <Link to="/syarat-ketentuan" className={item}>Syarat &amp; Ketentuan</Link>
                <Link to="/kontak" className={item}>Kontak</Link>
                {(isAdmin || isTeacher) && (
                  <Link to="/admin" className={`${item} mt-2 bg-primary/10 text-primary hover:bg-primary/15`}>
                    {isAdmin ? "Panel Admin" : "Panel Guru"}
                  </Link>
                )}
                <a href={settings?.["admin_whatsapp"] ? `https://wa.me/${settings["admin_whatsapp"]}` : "https://wa.me/62881022392900"} target="_blank" rel="noreferrer" className={item}>
                  <MessageCircle className="h-4 w-4 text-primary" /> Tanya Admin
                </a>
                {!session && <Link to="/auth" className={`${item} mt-2 bg-primary text-primary-foreground hover:bg-primary/90`}>Masuk / Daftar</Link>}
              </nav>
              {session && <div className="border-t pt-4"><Button variant="outline" className="w-full" onClick={logout}>Keluar</Button></div>}
            </SheetContent>
          </Sheet>

          <Link to="/" aria-label={`${siteName} — Beranda`} className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {logo}
            <span className="truncate font-display text-lg font-bold tracking-tight text-primary">{siteName}</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">
          <Link to="/kelas" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-primary">Pilih Kelas</Link>
          <Link to="/faq" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-primary">FAQ</Link>
          <Link to="/kontak" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-primary">Kontak</Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {session ? (
            <>
              <span className="hidden text-sm font-medium text-muted-foreground sm:inline">Assalamu’alaikum</span>
              <NotificationBell />
            </>
          ) : (
            <Button asChild size="sm" className="rounded-xl px-4">
              <Link to="/auth">Masuk</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
