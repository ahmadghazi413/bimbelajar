import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Sparkles, CheckCircle2, Award, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* HERO SECTION */}
      <section className="relative py-20 md:py-32 overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container px-4 text-center max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-background text-xs font-medium text-primary shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> Bimbingan Belajar Modern & Terstruktur
          </div>
          
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
            Belajar Efektif & Langsung ke Inti Bersama{" "}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Padat Ilmu
            </span>
          </h1>

          {/* DESKRIPSI UTAMA PLATFORM */}
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Padat Ilmu adalah bimbingan belajar berbasis daring yang dirancang untuk menyampaikan materi secara ringkas, lugas, dan praktis tanpa berbelit-belit. Dapatkan pemahaman konsep secara mendalam untuk meraih impian akademikmu.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button asChild size="lg" className="w-full sm:w-auto px-8 font-semibold">
              <Link to="/kelas">Jelajahi Kelas</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto px-8">
              <Link to="/auth">Daftar Sekarang</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* TENTANG KAMI / BIO SECTION */}
      <section className="py-16 border-y bg-muted/30">
        <div className="container px-4 max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-bold">Mengapa Memilih Padat Ilmu?</h2>
              <p className="text-muted-foreground leading-relaxed">
                Kami percaya bahwa setiap siswa berhak mendapatkan bimbingan berkualitas tinggi dengan metode belajar yang fleksibel dan terstruktur. Trik cepat, pembahasan soal mendalam, dan kurikulum yang diperbarui siap mendampingi proses belajarmu.
              </p>
              <ul className="space-y-2 pt-2">
                {[
                  "Materi padat, jelas, dan fokus pada pemahaman konsep.",
                  "Akses materi dan video pembelajaran kapan saja.",
                  "Latihan soal beserta pembahasan interaktif."
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 text-center space-y-2">
                <BookOpen className="h-8 w-8 text-primary mx-auto" />
                <h3 className="font-bold text-lg">Materi Ringkas</h3>
                <p className="text-xs text-muted-foreground">Langsung pada poin krusial ujian</p>
              </Card>
              <Card className="p-4 text-center space-y-2">
                <Award className="h-8 w-8 text-primary mx-auto" />
                <h3 className="font-bold text-lg">Kualitas Terjamin</h3>
                <p className="text-xs text-muted-foreground">Disusun oleh tutor berpengalaman</p>
              </Card>
              <Card className="p-4 text-center space-y-2 col-span-2">
                <Users className="h-8 w-8 text-primary mx-auto" />
                <h3 className="font-bold text-lg">Komunitas Belajar</h3>
                <p className="text-xs text-muted-foreground">Dukungan sesama pelajar di seluruh Indonesia</p>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
