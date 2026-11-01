import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/PageTitle";

export const Route = createFileRoute("/syarat-ketentuan")({
  head: () => ({
    meta: [
      { title: "Syarat & Ketentuan — PadatIlmu" },
      { name: "description", content: "Syarat dan ketentuan penggunaan layanan kelas ngaji online PadatIlmu." },
      { property: "og:title", content: "Syarat & Ketentuan — PadatIlmu" },
      { property: "og:description", content: "Syarat dan ketentuan penggunaan layanan kelas ngaji online PadatIlmu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold text-lg">{title}</h2>
      <div className="mt-2 text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function TermsPage() {
  return (
    <Page title="Syarat & Ketentuan" subtitle="Terakhir diperbarui: November 2026">
      <div className="space-y-4">
        <Section title="1. Ketentuan Umum">
          <p>
            Dengan mendaftar dan menggunakan layanan PadatIlmu, Anda menyetujui seluruh syarat dan ketentuan yang tercantum di halaman ini. PadatIlmu berhak mengubah ketentuan ini sewaktu-waktu dan perubahan akan diumumkan melalui website atau grup WhatsApp kelas.
          </p>
        </Section>

        <Section title="2. Akun Pengguna">
          <ul className="list-disc pl-5 space-y-1">
            <li>Satu akun hanya boleh digunakan oleh satu orang dan tidak boleh dipinjamkan atau diperjualbelikan.</li>
            <li>Anda bertanggung jawab menjaga kerahasiaan email dan kata sandi akun Anda.</li>
            <li>Informasi profil wajib diisi dengan data yang benar.</li>
          </ul>
        </Section>

        <Section title="3. Pembayaran & Akses Kelas">
          <ul className="list-disc pl-5 space-y-1">
            <li>Akses kelas (tautan Zoom, grup WhatsApp, rekaman, dan materi) hanya diberikan setelah pembayaran terverifikasi lunas oleh admin.</li>
            <li>Masa aktif akses mengikuti paket yang dipilih: paket bulanan berlaku 30 hari sejak konfirmasi, paket per sesi berlaku sesuai jumlah sesi yang dibeli.</li>
            <li>Kesalahan nominal transfer di luar ketentuan bukan tanggung jawab PadatIlmu, namun kami akan membantu proses klarifikasi.</li>
          </ul>
        </Section>

        <Section title="4. Hak Cipta Materi">
          <ul className="list-disc pl-5 space-y-1">
            <li>Seluruh materi, rekaman video, dan dokumen kelas adalah hak cipta PadatIlmu.</li>
            <li>Dilarang mengunduh ulang, merekam, menyalin, atau menyebarkan materi dan tautan kelas kepada pihak lain dalam bentuk apa pun.</li>
            <li>Pelanggaran ketentuan ini dapat menyebabkan akun dinonaktifkan tanpa pengembalian dana.</li>
          </ul>
        </Section>

        <Section title="5. Tata Tertib Kelas">
          <ul className="list-disc pl-5 space-y-1">
            <li>Murid diharapkan hadir tepat waktu dan menjaga adab selama kelas berlangsung.</li>
            <li>Gunakan nama asli saat bergabung di Zoom agar mudah dikenali pengajar.</li>
            <li>Dilarang menyampaikan konten yang mengandung SARA, ujaran kebencian, atau promosi di luar izin admin di grup maupun kelas.</li>
          </ul>
        </Section>

        <Section title="6. Pembatalan & Perubahan Jadwal">
          <p>
            PadatIlmu berhak mengubah jadwal atau mengganti pengajar apabila terjadi kendala, dengan pemberitahuan melalui grup WhatsApp. Sesi yang dibatalkan oleh pihak PadatIlmu akan diganti dengan sesi pengganti dan tidak mengurangi jatah sesi murid.
          </p>
        </Section>

        <Section title="7. Program Referral & Voucher">
          <ul className="list-disc pl-5 space-y-1">
            <li>Kode referral hanya dapat digunakan satu kali per akun baru dan tidak berlaku untuk pemilik kode itu sendiri.</li>
            <li>Voucher diskon mengikuti masa berlaku dan batas penggunaan yang ditetapkan admin.</li>
            <li>Penyalahgunaan kode (misalnya membuat akun palsu) dapat menyebabkan diskon dibatalkan.</li>
          </ul>
        </Section>

        <Section title="8. Penutup">
          <p>
            Pertanyaan mengenai syarat dan ketentuan ini dapat disampaikan melalui halaman Kontak atau tombol Tanya Admin. Dengan tetap menggunakan layanan setelah adanya perubahan ketentuan, Anda dianggap menyetujui perubahan tersebut.
          </p>
        </Section>
      </div>
    </Page>
  );
}
