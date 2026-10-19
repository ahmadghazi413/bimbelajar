import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { User, LogOut, BookOpen, ShieldCheck, Menu, MessageCircle, PlayCircle, CreditCard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const [openMobileMenu, setOpenMobileMenu] = useState(false);

  // Query dinamis untuk mengambil logo_url dari tabel settings
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
    staleTime: 1000 * 60 * 30, // cache 30 menit
  });

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        
        {/* LOGO & BRAND NAME */}
        <Link to="/" className="flex items-center gap-2.5 font-bold text-xl">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt="Padat Ilmu Logo" 
              className="h-8 w-auto max-w-[120px] object-contain" 
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-extrabold text-sm shadow-sm">
              PI
            </div>
          )}
          <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent tracking-tight">
            Padat Ilmu
          </span>
        </Link>

        {/* DESKTOP NAVIGATION LINKS */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link to="/" className="transition-colors hover:text-foreground/80 text-foreground/60">
            Beranda
          </Link>
          <Link to="/kelas" className="transition-colors hover:text-foreground/80 text-foreground/60">
            Daftar Kelas
          </Link>
        </nav>

        {/* DESKTOP USER PROFILE & MOBILE HAMBURGER */}
        <div className="flex items-center gap-2">
          
          {/* USER PROFILE DROPDOWN (Hanya Muncul di Desktop/Laptop) */}
          <div className="hidden md:block">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full bg-secondary">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium text-sm">{profile?.full_name || user.email}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/kelas-saya" className="cursor-pointer flex items-center gap-2">
                      <BookOpen className="h-4 w-4" /> Kelas Saya
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/video" className="cursor-pointer flex items-center gap-2">
                      <PlayCircle className="h-4 w-4" /> Riwayat Video
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/pembayaran" className="cursor-pointer flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> Riwayat Pembayaran
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profil" className="cursor-pointer flex items-center gap-2">
                      <User className="h-4 w-4" /> Profil
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="cursor-pointer flex items-center gap-2 text-primary">
                        <ShieldCheck className="h-4 w-4" /> Panel Admin
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer text-destructive focus:text-destructive flex items-center gap-2">
                    <LogOut className="h-4 w-4" /> Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm">
                <Link to="/auth">Masuk / Daftar</Link>
              </Button>
            )}
          </div>

          {/* MOBILE HAMBURGER MENU (Khusus Layar HP) */}
          <div className="md:hidden">
            <Sheet open={openMobileMenu} onOpenChange={setOpenMobileMenu}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Buka Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[350px] flex flex-col p-6">
                
                {/* HEADER MENU */}
                <SheetHeader className="relative text-center pb-6 border-b-0">
                  <SheetTitle className="text-primary text-xl font-semibold mt-2">
                    Menu
                  </SheetTitle>
                </SheetHeader>

                {/* LIST MENU */}
                <div className="flex flex-col space-y-7 mt-4 flex-1 overflow-y-auto px-2">
                  <Link
                    to="/"
                    onClick={() => setOpenMobileMenu(false)}
                    className="text-[17px] font-normal text-foreground/90"
                  >
                    Beranda
                  </Link>
                  <Link
                    to="/kelas"
                    onClick={() => setOpenMobileMenu(false)}
                    className="text-[17px] font-normal text-foreground/90"
                  >
                    Daftar Kelas
                  </Link>

                  {/* MENU USER (JIKA SUDAH LOGIN) */}
                  {user && (
                    <>
                      <Link
                        to="/kelas-saya"
                        onClick={() => setOpenMobileMenu(false)}
                        className="text-[17px] font-normal text-foreground/90"
                      >
                        Kelas Saya
                      </Link>
                      <Link
                        to="/video"
                        onClick={() => setOpenMobileMenu(false)}
                        className="text-[17px] font-normal text-foreground/90"
                      >
                        Riwayat Video
                      </Link>
                      <Link
                        to="/pembayaran"
                        onClick={() => setOpenMobileMenu(false)}
                        className="text-[17px] font-normal text-foreground/90"
                      >
                        Riwayat Pembayaran
                      </Link>
                      <Link
                        to="/profil"
                        onClick={() => setOpenMobileMenu(false)}
                        className="text-[17px] font-normal text-foreground/90"
                      >
                        Profil
                      </Link>
                      
                      {/* MENU ADMIN (JIKA ROLE ADMIN) */}
                      {isAdmin && (
                        <Link
                          to="/admin"
                          onClick={() => setOpenMobileMenu(false)}
                          className="text-[17px] font-medium text-primary"
                        >
                          Panel Admin
                        </Link>
                      )}
                    </>
                  )}

                  {/* BANTUAN ADMIN */}
                  <div className="pt-2">
                    <a
                      href="#"
                      className="flex items-center gap-3 text-[17px] font-normal text-foreground/90"
                    >
                      <MessageCircle className="h-5 w-5 text-primary" />
                      Bantuan Admin
                    </a>
                  </div>
                </div>

                {/* TOMBOL KELUAR / MASUK */}
                <div className="mt-auto pt-6 pb-4">
                  {user ? (
                    <Button
                      variant="outline"
                      className="w-full rounded-full py-6 text-base font-medium border-muted-foreground/30 shadow-sm"
                      onClick={() => {
                        signOut();
                        setOpenMobileMenu(false);
                      }}
                    >
                      Keluar
                    </Button>
                  ) : (
                    <Button
                      className="w-full rounded-full py-6 text-base font-medium shadow-sm"
                      asChild
                    >
                      <Link to="/auth" onClick={() => setOpenMobileMenu(false)}>
                        Masuk / Daftar
                      </Link>
                    </Button>
                  )}
                </div>

              </SheetContent>
            </Sheet>
          </div>

        </div>
      </div>
    </header>
  );
}
