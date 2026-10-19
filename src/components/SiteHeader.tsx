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
import { User, LogOut, BookOpen, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { user, profile, isAdmin, signOut } = useAuth();

  // Query dinamis untuk mengambil logo_url dari tabel settings jika tersedia
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

        {/* NAVIGATION LINKS */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link to="/" className="transition-colors hover:text-foreground/80 text-foreground/60">
            Beranda
          </Link>
          <Link to="/kelas" className="transition-colors hover:text-foreground/80 text-foreground/60">
            Katalog Kelas
          </Link>
        </nav>

        {/* USER PROFILE / LOGIN BUTTON */}
        <div className="flex items-center gap-3">
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
                  <Link to="/profil" className="cursor-pointer flex items-center gap-2">
                    <User className="h-4 w-4" /> Profil & Pengaturan
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer flex items-center gap-2">
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
      </div>
    </header>
  );
}
