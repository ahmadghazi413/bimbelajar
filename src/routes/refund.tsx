import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Kebijakan Refund — PadatIlmu" },
      { name: "description", content: "Kebijakan pengembalian dana (refund) untuk pembelian kelas di PadatIlmu." },
      { property: "og:title", content: "Kebijakan Refund — PadatIlmu" },
      { property: "og:description", content: "Kebijakan pengembalian dana (refund) untuk pembelian kelas di PadatIlmu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RefundPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold text-lg">{title}</h2>
      <div className="mt-2 text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function RefundPage() {
  return (
    <Page title="Kebijakan Refund" subtitle="Terakhir diperbarui: November 2026">
      <div className="space-y-4">
        <Section title="1. Pengembalian Dana Penuh">
          <p>
            Pengembalian dana 100% dapat diajukan apabila:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Pembayaran sudah dilakukan tetapi kelas dibatalkan oleh pihak PadatIlmu.</li>
            <li>Terjadi kesalahan transfer berlebih (kelebihan nominal akan dikembalikan penuh).</li>
            <li>Pengajuan dilakukan maksimal 3 hari setelah pembayaran dikonfirmasi dan murid <strong>belum mengikuti satu pun sesi kelas</strong>.</li>
          </ul>
        </Section>

        <Section title="2. Pengembalian Dana Sebagian">
          <p>
            Untuk paket per sesi, apabila murid mengundurkan diri setelah mengikuti sebagian sesi, dana dapat dikembalikan secara proporsional berdasarkan jumlah sesi yang belum diikuti, dipotong biaya administrasi sebesar 10%.
          </p>
          <p>
            Untuk paket bulanan, pengembalian dana sebagian tidak berlaku setelah kelas bulan berjalan dimulai.
          </p>
        </Section>

        <Section title="3. Dana yang Tidak Dapat Dikembalikan">
          <ul className="list-disc pl-5 space-y-1">
            <li>Murid tidak hadir tanpa pemberitahuan (rekaman tetap tersedia sesuai masa paket).</li>
            <li>Pelanggaran terhadap Syarat &amp; Ketentuan, misalnya menyebarkan rekaman atau tautan kelas ke pihak lain.</li>
            <li>Pengajuan refund melewati batas waktu yang ditentukan di atas.</li>
          </ul>
        </Section>

        <Section title="4. Cara Mengajukan Refund">
          <p>
            Ajukan permohonan refund melalui halaman Kontak atau tombol Tanya Admin dengan menyertakan:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Nama lengkap dan email akun yang terdaftar.</li>
            <li>Nama kelas dan tanggal pembayaran.</li>
            <li>Alasan pengajuan refund.</li>
            <li>Nomor rekening tujuan pengembalian dana.</li>
          </ul>
          <p>
            Tim kami akan memproses pengajuan maksimal 7 hari kerja setelah permohonan disetujui.
          </p>
        </Section>

        <div className="rounded-xl border bg-primary/5 p-5 text-center">
          <p className="text-sm text-muted-foreground">Ada pertanyaan seputar refund?</p>
          <Button asChild className="mt-3">
            <Link to="/kontak">Hubungi Admin</Link>
          </Button>
        </div>
      </div>
    </Page>
  );
}
