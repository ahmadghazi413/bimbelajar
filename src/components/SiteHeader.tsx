import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BookOpen, Menu, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  // Query dinamis logo dari settings (jika ada)
  const { data: logoUrl } = useQuery({
    queryKey: ["site-logo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "logo_url")
        .maybeSingle();

      if (error || !data) return null;
      return data.value as string;
    },
    staleTime: 1000 * 60 * 30,
  });

  const closeMenu = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        
        {/* LOGO & NAMA BRAND */}
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Padat Ilmu Logo"
              className="h-8 w-auto object-contain"
            />
          ) : (
            <BookOpen className="h-6 w-6 text-primary" />
          )}
          <span className="text-primary font-bold">Padat Ilmu</span>
        </Link>

        {/* DESKTOP NAVIGATION (Tampilan Laptop) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link to="/" className="hover:text-primary transition-colors">
            Beranda
          </Link>
          <Link to="/kelas" className="hover:text-primary transition-colors">
            Daftar Kelas
          </Link>
          {!loading && user && (
            <>
              <Link to="/kelas-saya" className="hover:text-primary transition-colors">
                Kelas Saya
              </Link>
              <Link to="/video" className="hover:text-primary transition-colors">
                Riwayat Video
              </Link>
              <Link to="/pembayaran" className="hover:text-primary transition-colors">
                Riwayat Pembayaran
              </Link>
              <Link to="/profil" className="hover:text-primary transition-colors">
                Profil
              </Link>
              {isAdmin && (
                <Link to="/admin" className="text-primary font-semibold hover:underline">
                  Panel Admin
                </Link>
              )}
            </>
          )}
        </nav>

        {/* DESKTOP BUTTON */}
        <div className="hidden md:flex items-center gap-3">
          {loading ? (
            <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
          ) : user ? (
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Keluar
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Masuk / Daftar</Link>
            </Button>
          )}
        </div>

        {/* MOBILE HAMBURGER MENU (Tampilan HP) */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-[300px] sm:w-[350px] flex flex-col justify-between p-6">
              <div>
                <SheetHeader className="text-center pb-4 border-b">
                  <SheetTitle className="text-xl font-semibold text-primary text-center">
                    Menu
                  </SheetTitle>
                </SheetHeader>

                <div className="flex flex-col space-y-4 py-6 text-base font-medium">
                  <Link to="/" onClick={closeMenu} className="hover:text-primary transition-colors">
                    Beranda
                  </Link>
                  <Link to="/kelas" onClick={closeMenu} className="hover:text-primary transition-colors">
                    Daftar Kelas
                  </Link>

                  {/* HANYA MUNCUL JIKA USER SUDAH LOGIN & LOADING SELESAI */}
                  {!loading && user && (
                    <>
                      <Link to="/kelas-saya" onClick={closeMenu} className="hover:text-primary transition-colors">
                        Kelas Saya
                      </Link>
                      <Link to="/video" onClick={closeMenu} className="hover:text-primary transition-colors">
                        Riwayat Video
                      </Link>
                      <Link to="/pembayaran" onClick={closeMenu} className="hover:text-primary transition-colors">
                        Riwayat Pembayaran
                      </Link>
                      <Link to="/profil" onClick={closeMenu} className="hover:text-primary transition-colors">
                        Profil
                      </Link>
                      {isAdmin && (
                        <Link to="/admin" onClick={closeMenu} className="text-primary font-semibold">
                          Panel Admin
                        </Link>
                      )}
                    </>
                  )}

                  <a
                    href="#"
                    onClick={closeMenu}
                    className="flex items-center gap-2 pt-2 hover:text-primary transition-colors"
                  >
                    <MessageCircle className="h-5 w-5 text-primary" />
                    Bantuan Admin
                  </a>
                </div>
              </div>

              {/* TOMBOL AKSI DI PALING BAWAH MENU */}
              <div className="pb-4">
                {loading ? (
                  <div className="h-12 w-full bg-muted animate-pulse rounded-full" />
                ) : user ? (
                  <Button
                    variant="outline"
                    className="w-full rounded-full py-5 text-base"
                    onClick={() => {
                      signOut();
                      closeMenu();
                    }}
                  >
                    Keluar
                  </Button>
                ) : (
                  <Button
                    className="w-full rounded-full py-5 text-base"
                    asChild
                  >
                    <Link to="/auth" onClick={closeMenu}>
                      Masuk / Daftar
                    </Link>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

      </div>
    </header>
  );
}
