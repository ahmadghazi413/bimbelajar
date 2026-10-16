import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, BookOpen } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { session, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

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
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-primary-foreground">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold text-primary">Bimbelajar</span>
        </Link>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle className="font-display text-primary">Menu</SheetTitle>
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
                  {isAdmin && <Link to="/admin" className={`${item} text-primary`}>Panel Admin</Link>}
                </>
              ) : (
                <Link to="/auth" className={item}>Masuk / Daftar</Link>
              )}
            </nav>
            {session && (
              <Button variant="outline" className="mt-6 w-full" onClick={logout}>Keluar</Button>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
