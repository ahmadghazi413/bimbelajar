import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  BookOpen, 
  Sparkles, 
  Award, 
  Users, 
  CalendarDays, 
  MessageCircle, 
  Crown, 
  ArrowRight,
  GraduationCap,
  Video,
  Languages
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { subjectsQuery } from "@/lib/queries";
import { packageTitle, tanggal } from "@/lib/format";
import { packageEnd, daysLeft } from "@/lib/notifications";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Padat Ilmu — Bimbingan Belajar Online" },
      { name: "description", content: "Platform bimbingan belajar daring materi padat, terstruktur, dan langsung ke inti." },
      { property: "og:title", content: "Padat Ilmu — Bimbingan Belajar Online" },
      { property: "og:description", content: "Platform bimbingan belajar daring materi padat, terstruktur, dan langsung ke inti." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  // 1. Ambil data enrollment pengguna dan profil
  const { data: userData } = useQuery({
    queryKey: ["home-user-data", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: enr } = await supabase
        .from("enrollments")
        .select("*, classes(*)")
        .eq("user_id", userId!)
        .neq("status", "rejected")
        .order("created_at", { ascending: false });

      const { data: priv } = await supabase.from("class_private").select("*");
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId!)
        .maybeSingle();

      return { enr: enr ?? [], priv: priv ?? [], prof };
    },
  });

  // 2. Ambil daftar ilmu yang tersedia di sistem (Tahsin, Bahasa, Webinar)
  const { data: subjects = [] } = useQuery(subjectsQuery);

  const enrollments = userData?.enr ?? [];
  const activePaidEnrollment = enrollments.find((e) => {
    if (e.status !== "paid") return false;
    const end = packageEnd(e);
    if (!end) return true;
    return daysLeft(end) > 0;
  });

  const isPremium = !!activePaidEnrollment;
  const userDisplayName =
    userData?.prof?.full_name ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.email?.split("@")[0] ||
    "Ilmuwan";

  const primaryEnrollment = activePaidEnrollment || enrollments[0];
  const primaryClass = primaryEnrollment?.classes;
  const primaryPriv = userData?.priv?.find((p) => p.class_id === primaryEnrollment?.class_id);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-8">
        
        {/* ========================================================= */}
        {/* BAR 1: STATUS AKUN PENGGUNA (PREMIUM/FREE) & HERO PADAT   */}
        {/* ========================================================= */}
        <section className="rounded-3xl border bg-gradient-to-b from-primary/10 via-primary/5 to-card p-5 sm:p-7 shadow-xs">
          <div className="flex items-center justify-between border-b pb-4 mb-4 gap-2">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 text-primary font-bold text-sm">
                {userDisplayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Akun Pengguna</p>
                <p className="text-sm sm:text-base font-bold text-foreground truncate max-w-[170px] sm:max-w-xs">
                  {session ? userDisplayName : "Tamu / Pengunjung"}
                </p>
              </div>
            </div>

            <div>
              {session ? (
                isPremium ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shadow-xs">
                    <Crown className="h-3.5 w-3.5 text-amber-500" /> Premium
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-secondary text-secondary-foreground border">
                    Free Member
                  </span>
                )
              ) : (
                <Button asChild size="sm" variant="outline" className="text-xs h-7 px-2.5 font-medium">
                  <Link to="/auth">Masuk Akun</Link>
                </Button>
              )}
            </div>
          </div>

          <div className="text-center space-y-3 pt-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border bg-background text-[11px] sm:text-xs font-medium text-primary shadow-xs">
              <Sparkles className="h-3.5 w-3.5" /> Bimbingan Belajar Modern & Terstruktur
            </div>
            
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Belajar Efektif & Langsung ke Inti Bersama{" "}
              <span className="text-primary">Padat Ilmu</span>
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Platform bimbingan daring untuk materi ringkas, lugas, dan praktis tanpa berbelit-belit. Dapatkan pemahaman mendalam secara terarah.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button asChild size="sm" className="px-6 font-semibold shadow-xs">
                <Link to="/kelas">Pilih Kelas</Link>
              </Button>
              {session ? (
                <Button asChild size="sm" variant="outline" className="px-5">
                  <Link to="/kelas-saya">Kelas Saya</Link>
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline" className="px-5">
                  <Link to="/auth">Daftar Sekarang</Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* BAR 2: KELAS SAYA (PERSIS FOTO / EFEK BLUR JIKA BELUM IKUT)*/}
        {/* ========================================================= */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">Kelas Saya</h2>
            {primaryEnrollment && (
              <Link to="/kelas-saya" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                Semua Kelas <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          {primaryEnrollment && primaryClass ? (
            /* Kartu Kelas Aktif Seperti Foto / Screenshot */
            <div className="rounded-3xl border bg-card p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl sm:text-2xl font-bold text-primary">
                  {primaryClass.name}
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  primaryEnrollment.status === "paid" 
                    ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-600/30"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                }`}>
                  {primaryEnrollment.status === "paid" ? "Lunas" : "Menunggu Konfirmasi"}
                </span>
              </div>

              {primaryClass.schedule && (
                <p className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground font-medium">
                  <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                  {primaryClass.schedule}
                </p>
              )}

              {primaryEnrollment.status === "paid" && (
                <div className="rounded-2xl bg-secondary/50 p-3.5 text-xs sm:text-sm space-y-1">
                  <p className="font-semibold text-foreground">
                    Paket {packageTitle(primaryEnrollment)}
                  </p>
                  {(() => {
                    const end = packageEnd(primaryEnrollment);
                    if (end) {
                      const d = daysLeft(end);
                      return (
                        <p className="text-muted-foreground">
                          {d <= 0 ? "Paket sudah habis" : `Sisa ${d} hari`} · berlaku sampai {tanggal(end.toISOString())}
                        </p>
                      );
                    }
                    const total = primaryEnrollment.sessions_total || 0;
                    const used = primaryEnrollment.sessions_used || 0;
                    return (
                      <p className="text-muted-foreground">
                        Sisa {Math.max(total - used, 0)} sesi dari total {total} sesi
                      </p>
                    );
                  })()}
                </div>
              )}

              <div className="grid gap-2 pt-1">
                {primaryPriv?.whatsapp_link && primaryEnrollment.status === "paid" ? (
                  <Button asChild size="lg" className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold">
                    <a href={primaryPriv.whatsapp_link} target="_blank" rel="noreferrer">
                      <MessageCircle className="h-5 w-5 mr-1" /> Gabung Grup WhatsApp
                    </a>
                  </Button>
                ) : (
                  <Button asChild size="lg" className="w-full font-semibold">
                    <Link to="/kelas-saya">Buka Kelas Saya</Link>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* Tampilan Kartu Agak Blur Jika Belum Mengikuti Kelas */
            <div className="relative overflow-hidden rounded-3xl border bg-card/60 p-6 shadow-xs">
              <div className="filter blur-[2.5px] opacity-40 select-none pointer-events-none space-y-4">
                <div className="flex justify-between items-center">
                  <div className="h-6 w-36 bg-foreground/20 rounded-md"></div>
                  <span className="px-3 py-1 text-xs rounded-full bg-emerald-600/30 text-emerald-800">Lunas</span>
                </div>
                <div className="h-4 w-52 bg-foreground/15 rounded"></div>
                <div className="p-3.5 rounded-2xl bg-muted/60 space-y-1.5">
                  <div className="h-4 w-32 bg-foreground/20 rounded"></div>
                  <div className="h-3.5 w-44 bg-foreground/15 rounded"></div>
                </div>
                <div className="h-11 w-full bg-emerald-600/40 rounded-xl"></div>
              </div>

              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 backdrop-blur-[1px] p-6 text-center">
                <BookOpen className="h-9 w-9 text-primary mb-2 opacity-85" />
                <h3 className="font-bold text-base sm:text-lg">Belum Ada Kelas yang Diikuti</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xs leading-relaxed">
                  Ikuti bimbingan belajar berkualitas dengan kurikulum terstruktur sekarang.
                </p>
                <Button asChild size="sm" className="mt-4 px-6 font-semibold shadow-xs">
                  <Link to="/kelas">Daftar Kelas</Link>
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* ========================================================= */}
        {/* BAR 3: DAFTAR ILMU (TAHSIN, BAHASA, WEBINAR)              */}
        {/* ========================================================= */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">Pilih Ilmu</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Tentukan bidang materi yang ingin Anda pelajari secara mendalam.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. TAHSIN */}
            <Card className="flex flex-col justify-between p-5 rounded-3xl border bg-card hover:border-primary/50 transition-all shadow-xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <GraduationCap className="h-6 w-6" />
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Tersedia
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Tahsin Al-Qur'an</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-3">
                    {subjects.find((s) => s.slug === "tahsin")?.bio ||
                      "Ilmu memperbaiki bacaan Al-Qur'an: melafalkan huruf dari tempat keluarnya (makhraj), mengenal sifat huruf, dan tajwid dari nol."}
                  </p>
                </div>
              </div>
              <div className="pt-5 mt-auto">
                <Button asChild className="w-full font-semibold" size="sm">
                  <Link to="/ilmu/$slug" params={{ slug: "tahsin" }}>
                    Pilih Kelas →
                  </Link>
                </Button>
              </div>
            </Card>

            {/* 2. BAHASA */}
            <Card className="flex flex-col justify-between p-5 rounded-3xl border bg-card hover:border-primary/50 transition-all shadow-xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-500/10 text-sky-600">
                    <Languages className="h-6 w-6" />
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border">
                    Segera Hadir
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Bahasa</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-3">
                    {subjects.find((s) => s.slug.includes("bahasa"))?.bio ||
                      "Pembelajaran tata bahasa dan percakapan praktis terstruktur untuk memperluas wawasan komunikasi internasional."}
                  </p>
                </div>
              </div>
              <div className="pt-5 mt-auto">
                <Button asChild variant="outline" className="w-full font-semibold" size="sm">
                  <Link
                    to="/ilmu/$slug"
                    params={{
                      slug: subjects.find((s) => s.slug.includes("bahasa"))?.slug || "bahasa-",
                    }}
                  >
                    Pilih Kelas →
                  </Link>
                </Button>
              </div>
            </Card>

            {/* 3. WEBINAR */}
            <Card className="flex flex-col justify-between p-5 rounded-3xl border bg-card hover:border-primary/50 transition-all shadow-xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-purple-500/10 text-purple-600">
                    <Video className="h-6 w-6" />
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border">
                    Workshop & Tematik
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Webinar</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-3">
                    {subjects.find((s) => s.slug === "webinar")?.bio ||
                      "Sesi pembelajaran intensif, tanya jawab interaktif, dan workshop khusus bersama narasumber berpengalaman."}
                  </p>
                </div>
              </div>
              <div className="pt-5 mt-auto">
                <Button asChild variant="outline" className="w-full font-semibold" size="sm">
                  <Link
                    to="/ilmu/$slug"
                    params={{
                      slug: subjects.find((s) => s.slug === "webinar")?.slug || "webinar",
                    }}
                  >
                    Pilih Kelas →
                  </Link>
                </Button>
              </div>
            </Card>
          </div>
        </section>

        {/* ========================================================= */}
        {/* BAR 4: MENGAPA MEMILIH KAMI (DIRAPIHKAN)                  */}
        {/* ========================================================= */}
        <section className="pt-4 border-t space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold">Mengapa Memilih Padat Ilmu?</h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Bimbingan berkualitas tinggi dengan metode belajar yang fleksibel, terarah, dan ramah untuk pemula maupun dewasa.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 sm:p-5 text-center space-y-2 rounded-2xl bg-card border shadow-xs">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary mx-auto">
                <BookOpen className="h-5 w-5" />
              </span>
              <h3 className="font-bold text-sm sm:text-base">Materi Ringkas & Padat</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Fokus langsung pada inti pemahaman tanpa membuang waktu dengan pengantar berbelit.
              </p>
            </Card>

            <Card className="p-4 sm:p-5 text-center space-y-2 rounded-2xl bg-card border shadow-xs">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary mx-auto">
                <Award className="h-5 w-5" />
              </span>
              <h3 className="font-bold text-sm sm:text-base">Tutor Berpengalaman</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Dibimbing langsung oleh pengajar yang sabar, ramah, dan berpengalaman di bidangnya.
              </p>
            </Card>

            <Card className="p-4 sm:p-5 text-center space-y-2 rounded-2xl bg-card border shadow-xs">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary mx-auto">
                <Users className="h-5 w-5" />
              </span>
              <h3 className="font-bold text-sm sm:text-base">Grup & Rekaman Sesi</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Akses video rekaman kapan saja serta dukungan grup WhatsApp interaktif sesama murid.
              </p>
            </Card>
          </div>

          <div className="rounded-2xl bg-muted/40 p-4 sm:p-5 border text-center space-y-2">
            <p className="text-xs sm:text-sm font-medium text-foreground">
              "Sebaik-baik kalian adalah orang yang belajar Al-Qur'an dan mengajarkannya."
            </p>
            <p className="text-[11px] text-muted-foreground">
              (HR. Bukhari) · Belajar dengan nyaman dan berkah bersama keluarga Padat Ilmu.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
