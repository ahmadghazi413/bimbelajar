import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, MessageCircle, Clock } from "lucide-react";
import { Page } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";
import { settingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/kontak")({
  head: () => ({
    meta: [
      { title: "Kontak — PadatIlmu" },
      { name: "description", content: "Hubungi admin PadatIlmu melalui WhatsApp atau email untuk pertanyaan seputar kelas, pembayaran, dan refund." },
      { property: "og:title", content: "Kontak — PadatIlmu" },
      { property: "og:description", content: "Hubungi admin PadatIlmu melalui WhatsApp atau email untuk pertanyaan seputar kelas, pembayaran, dan refund." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KontakPage,
});

function KontakPage() {
  const { data: settings } = useQuery(settingsQuery);
  const wa = settings?.["admin_whatsapp"] || "62881022392900";
  const email = "padatilmu@gmail.com";

  return (
    <Page title="Kontak Kami" subtitle="Kami siap membantu pertanyaan seputar pendaftaran, pembayaran, jadwal kelas, hingga pengajuan refund.">
      <div className="space-y-4">
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-4 rounded-xl border bg-card p-5 transition hover:bg-secondary/50"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <MessageCircle className="h-6 w-6" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">WhatsApp Admin</span>
            <span className="block text-sm text-muted-foreground">+{wa} — balasan tercepat untuk pertanyaan mendesak</span>
          </span>
          <Button size="sm" variant="outline">Chat</Button>
        </a>

        <a
          href={`mailto:${email}`}
          className="flex items-center gap-4 rounded-xl border bg-card p-5 transition hover:bg-secondary/50"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <Mail className="h-6 w-6" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Email</span>
            <span className="block text-sm text-muted-foreground">{email} — untuk pengajuan refund dan kerja sama</span>
          </span>
          <Button size="sm" variant="outline">Kirim</Button>
        </a>

        <div className="flex items-center gap-4 rounded-xl border bg-card p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-secondary text-foreground">
            <Clock className="h-6 w-6" />
          </span>
          <span>
            <span className="block font-semibold">Jam Layanan Admin</span>
            <span className="block text-sm text-muted-foreground">Senin–Sabtu, 08.00–21.00 WIB. Pesan di luar jam layanan akan dibalas keesokan hari.</span>
          </span>
        </div>
      </div>
    </Page>
  );
}
