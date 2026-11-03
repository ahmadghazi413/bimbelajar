import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Kartu "Download Aplikasi PadatIlmu" — memasang web ke layar utama HP. */
export function InstallAppCard() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (!evt) return setHelp(true);
    await evt.prompt();
    const r = await evt.userChoice;
    if (r.outcome === "accepted") setInstalled(true);
    setEvt(null);
  }

  return (
    <div className="flex flex-col gap-3 rounded-3xl border bg-card p-5 sm:flex-row sm:items-center">
      <img src="/icon-192.png" alt="Ikon aplikasi PadatIlmu" width={56} height={56} className="h-14 w-14 rounded-2xl" />
      <div className="flex-1">
        <p className="flex items-center gap-1.5 font-semibold">
          <Smartphone className="h-4 w-4 text-primary" /> Download Aplikasi PadatIlmu
        </p>
        <p className="text-sm text-muted-foreground">Pasang di HP, buka langsung dari ikon tanpa perlu buka browser.</p>
        {help && (
          <p className="mt-2 text-xs text-muted-foreground">
            Buka di Chrome → ketuk menu ⋮ → pilih <b>"Instal aplikasi"</b> / <b>"Tambahkan ke layar utama"</b>. Di iPhone:
            ketuk tombol Bagikan → <b>"Tambah ke Layar Utama"</b>.
          </p>
        )}
      </div>
      <Button variant="hero" onClick={install}>
        <Download className="mr-1 h-4 w-4" /> Pasang Aplikasi
      </Button>
    </div>
  );
}
