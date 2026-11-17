import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { settingsQuery } from "@/lib/queries";

export function SiteFooter() {
  const { data: settings } = useQuery(settingsQuery);
  const siteName = settings?.["site_name"]?.trim() || "PadatIlmu";
  const logoUrl = settings?.["logo_url"] || "";
  const wa = settings?.["admin_whatsapp"] ? `https://wa.me/${settings["admin_whatsapp"]}` : "https://wa.me/62881022392900";
  const link = "block py-0.5 text-sm font-semibold text-muted-foreground hover:text-primary";
  return (
    <footer className="border-t-[3px] border-gold bg-card pt-6 pb-4">
      <div className="mx-auto max-w-6xl px-5 sm:px-7">
        <div className="grid gap-4 sm:gap-7 sm:grid-cols-[1.4fr_1fr_auto]">
          <div>
            <Link to="/" aria-label={siteName} className="inline-block">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-9 w-auto max-w-[150px] object-contain" />
              ) : (
                <span className="font-display text-xl font-extrabold text-primary">{siteName}</span>
              )}
            </Link>
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
              Belajar membaca Al-Qur’an dari rumah, dengan pengajar yang sabar dan materi bertahap.
            </p>
          </div>
          <nav aria-label="Informasi" className="flex flex-wrap gap-x-5 gap-y-0.5 sm:block">
            <Link to="/faq" className={link}>Pertanyaan umum</Link>
            <Link to="/refund" className={link}>Kebijakan refund</Link>
            <Link to="/syarat-ketentuan" className={link}>Syarat &amp; ketentuan</Link>
            <Link to="/kontak" className={link}>Kontak</Link>
          </nav>
          <Button asChild className="h-11 rounded-xl px-5 font-bold">
            <a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> Tanya admin</a>
          </Button>
        </div>
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">© {new Date().getFullYear()} {siteName}</p>
      </div>
    </footer>
  );
}
