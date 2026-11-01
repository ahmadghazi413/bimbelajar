import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/PageTitle";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — PadatIlmu" },
      { name: "description", content: "Pertanyaan yang sering diajukan seputar kelas ngaji online PadatIlmu: pendaftaran, pembayaran, jadwal, dan akses rekaman." },
      { property: "og:title", content: "FAQ — PadatIlmu" },
      { property: "og:description", content: "Pertanyaan yang sering diajukan seputar kelas ngaji online PadatIlmu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FaqPage,
});

const FAQS: { q: string; a: string }[] = [
  {
    q: "Apakah kelas ini cocok untuk pemula yang benar-benar dari nol?",
    a: "Sangat cocok. Kelas Level 1 dirancang khusus untuk dewasa dan ibu-ibu yang belum pernah belajar membaca Al-Qur'an sama sekali. Materi dimulai dari pengenalan huruf hijaiyah dengan metode yang sabar dan tidak membuat malu.",
  },
  {
    q: "Bagaimana cara mendaftar kelas?",
    a: "Buat akun terlebih dahulu melalui menu Masuk/Daftar, lalu pilih ilmu dan kelas yang diinginkan, klik Daftar, dan ikuti instruksi pembayaran. Setelah pembayaran dikonfirmasi admin, kelas langsung terbuka di halaman Kelas Saya.",
  },
  {
    q: "Metode pembayaran apa saja yang tersedia?",
    a: "Pembayaran dilakukan melalui transfer bank atau scan kode QRIS yang tampil di halaman pembayaran. Setelah membayar, unggah foto bukti transfer lalu klik konfirmasi. Admin akan memverifikasi maksimal 1x24 jam.",
  },
  {
    q: "Apakah ada pilihan paket pembayaran?",
    a: "Ya. Tersedia paket bulanan dan paket per sesi (1, 2, 4, 8, 10, 12, atau 16 sesi). Anda bisa memilih paket yang paling sesuai di halaman pembayaran sebelum konfirmasi.",
  },
  {
    q: "Bagaimana jika saya tidak bisa hadir di kelas live Zoom?",
    a: "Tidak masalah. Setiap sesi direkam dan tautan rekaman akan tersedia di halaman Kelas Saya, sehingga Anda bisa mengulang materi kapan saja selama masa paket masih aktif.",
  },
  {
    q: "Apakah saya mendapat grup WhatsApp?",
    a: "Ya. Murid yang pembayarannya sudah lunas akan mendapatkan tautan grup WhatsApp kelas di halaman Kelas Saya untuk tanya jawab dan informasi jadwal.",
  },
  {
    q: "Apa itu kode referral dan bagaimana cara memakainya?",
    a: "Setiap akun memiliki kode referral pribadi yang bisa dilihat di halaman Profil. Bagikan kode tersebut ke teman; saat teman mendaftar kelas dan memasukkan kode Anda, ia mendapat diskon sesuai pengaturan admin.",
  },
  {
    q: "Apakah bisa mengubah jadwal atau pindah kelas?",
    a: "Bisa, selama kuota kelas tujuan masih tersedia. Silakan hubungi admin melalui tombol Tanya Admin atau halaman Kontak untuk dibantu proses perpindahannya.",
  },
];

function FaqPage() {
  return (
    <Page title="Pertanyaan Umum (FAQ)" subtitle="Jawaban atas pertanyaan yang paling sering ditanyakan calon murid dan murid PadatIlmu.">
      <Accordion type="single" collapsible className="rounded-xl border bg-card px-4">
        {FAQS.map((f, i) => (
          <AccordionItem key={i} value={`faq-${i}`}>
            <AccordionTrigger className="text-base">{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <div className="mt-6 rounded-xl border bg-primary/5 p-5 text-center">
        <p className="text-sm text-muted-foreground">Belum menemukan jawaban yang dicari?</p>
        <Button asChild className="mt-3">
          <Link to="/kontak">Hubungi Admin</Link>
        </Button>
      </div>
    </Page>
  );
}
