import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { settingsQuery } from "@/lib/queries";

export function SiteFooter() {
  const { data: settings } = useQuery(settingsQuery);
  const siteName = settings?.["site_name"]?.trim() || "PadatIlmu";
  const wa = settings?.["admin_whatsapp"] ? `https://wa.me/${settings["admin_whatsapp"]}` : "https://wa.me/62881022392900";
  const link = "block py-1 text-sm font-semibold text-muted-foreground hover:text-primary";
  return (
    <footer className="border-t-[3px] border-gold bg-card pt-9 pb-6">
      <div className="mx-auto max-w-6xl px-5 sm:px-7">
        <div className="grid gap-7 sm:grid-cols-[1.4fr_1fr_auto]">
          <div>
            <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-extrabold text-primary">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground ring-[1.5px] ring-inset ring-gold">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </span>
              {siteName}
            </Link>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Belajar membaca Al-Qur’an dari rumah, dengan pengajar yang sabar dan materi bertahap.
            </p>
          </div>
          <nav aria-label="Informasi">
            <Link to="/faq" className={link}>Pertanyaan umum</Link>
            <Link to="/refund" className={link}>Kebijakan refund</Link>
            <Link to="/syarat-ketentuan" className={link}>Syarat &amp; ketentuan</Link>
            <Link to="/kontak" className={link}>Kontak</Link>
          </nav>
          <Button asChild className="h-12 rounded-xl px-5 font-bold">
            <a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> Tanya admin</a>
          </Button>
        </div>
        <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">© {new Date().getFullYear()} {siteName}</p>
      </div>
    </footer>
  );
}
