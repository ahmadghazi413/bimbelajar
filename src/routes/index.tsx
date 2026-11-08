import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  CalendarDays, 
  MessageCircle, 
  Crown, 
  ArrowRight,
  GraduationCap,
  Video,
  Languages,
  Check,
  Play,
  Clock,
  ChevronLeft,
  ChevronRight,
  BookOpen
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { subjectsQuery } from "@/lib/queries";
import { packageTitle } from "@/lib/format";
import { packageEnd, daysLeft } from "@/lib/notifications";
import { NotificationModal } from "@/components/NotificationModal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Padat Ilmu — Belajar Membaca Al-Qur'an dari Nol" },
      { name: "description", content: "Kelas ngaji online untuk dewasa dan ibu-ibu mulai dari nol bersama pengajar sabar dan materi bertahap." },
      { property: "og:title", content: "Padat Ilmu — Belajar Membaca Al-Qur'an dari Nol" },
      { property: "og:description", content: "Kelas ngaji online untuk dewasa dan ibu-ibu mulai dari nol bersama pengajar sabar dan materi bertahap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [activeSlide, setActiveSlide] = useState(0);

  // 1. Ambil data santri aktif dan sesi kelas jika login
  const { data: userData } = useQuery({
    queryKey: ["home-user-data", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: enr } = await supabase
        .from("enrollments")
        .select("*, classes(*, class_sessions(*))")
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

  // 2. Ambil data bidang ilmu dari database
  const { data: subjects = [] } = useQuery(subjectsQuery);

  // Filter kelas unik yang diikuti (jika ikut Tahsin, Webinar, dsb)
  const allEnr = userData?.enr ?? [];
  const startOf = (x: any) => x.starts_at ?? x.paid_at ?? x.created_at ?? "";
  const pickedMap = new Map<string, (typeof allEnr)[number]>();
  for (const x of allEnr) {
    const cur = pickedMap.get(x.class_id);
    if (!cur) pickedMap.set(x.class_id, x);
    else if (x.status === "paid" && (cur.status !== "paid" || startOf(x) > startOf(cur))) {
      pickedMap.set(x.class_id, x);
    }
  }
  const myClasses = [...pickedMap.values()].filter((e) => !!e.classes);

  const activePaidEnrollment = myClasses.find((e) => {
    if (e.status !== "paid") return false;
    const end = packageEnd(e);
    if (!end) return true;
    return daysLeft(end) > 0;
  });

  const isPremium = !!activePaidEnrollment;
  const userDisplayName =
    userData?.prof?.["full_name"] ||
    (session?.user?.user_metadata?.["full_name"] as string | undefined) ||
    session?.user?.email?.split("@")[0] ||
    "Santri";

  const currentEnrollment = myClasses[Math.min(activeSlide, Math.max(0, myClasses.length - 1))];
  const currentClass = currentEnrollment?.classes as any;
  const currentPriv = userData?.priv?.find((p) => p.class_id === currentEnrollment?.class_id);

  // Ambil daftar sesi kelas yang terbit
  const currentSessions: any[] = (currentClass?.class_sessions ?? [])
    .filter((s: any) => s.is_published !== false)
    .sort((a: any, b: any) => (a.number ?? 0) - (b.number ?? 0));

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NotificationModal />
      
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-7 py-4 sm:py-6 space-y-12">
        
        {/* BAR STATUS SANTRI (Bila sudah login) */}
        {session && (
          <div className="flex items-center justify-between rounded-2xl border bg-card/80 backdrop-blur-sm px-4 py-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                {userDisplayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Selamat datang,</p>
                <p className="text-sm font-bold text-foreground truncate max-w-[180px] sm:max-w-xs">
                  {userDisplayName}
                </p>
              </div>
            </div>
            <div>
              {isPremium ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  <Crown className="h-3.5 w-3.5 text-amber-500" /> Premium
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border">
                  Akun Terdaftar
                </span>
              )}
            </div>
          </div>
        )}

        {/* HERO SECTION */}
        <section className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-12 items-center pt-2 pb-6">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-bold">
              <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />
              Kelas ngaji online
            </span>

            <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.12] text-foreground">
              Belajar membaca Al-Qur’an{" "}
              <em className="not-italic text-primary underline decoration-gold/50 underline-offset-4">
                dari nol
              </em>
              , dari rumah.
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
              Untuk dewasa dan ibu-ibu yang ingin mulai dari dasar. Belajar bersama pengajar yang sabar, dengan materi yang disusun bertahap.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button asChild size="lg" className="rounded-xl px-7 font-bold shadow-sm">
                <Link to="/kelas">
                  Lihat kelas <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl px-6 font-semibold border-border/80">
                <a href="#cara">Cara belajarnya</a>
              </Button>
            </div>

            {/* 3 POIN UTAMA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border/60">
              <div className="space-y-1">
                <b className="block font-display text-base font-extrabold text-foreground">Lewat Zoom</b>
                <span className="text-xs sm:text-sm text-muted-foreground leading-snug block">
                  Kelas langsung bersama pengajar
                </span>
              </div>
              <div className="space-y-1">
                <b className="block font-display text-base font-extrabold text-foreground">Ada rekaman</b>
                <span className="text-xs sm:text-sm text-muted-foreground leading-snug block">
                  Tonton ulang kapan saja
                </span>
              </div>
              <div className="space-y-1">
                <b className="block font-display text-base font-extrabold text-foreground">Grup WhatsApp</b>
                <span className="text-xs sm:text-sm text-muted-foreground leading-snug block">
                  Tempat bertanya sesama murid
                </span>
              </div>
            </div>
          </div>

          {/* SISI KANAN: KARTU KELAS SAYA / PRATINJAU */}
          <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-emerald-100/60 via-amber-50/50 to-emerald-50/40 dark:from-emerald-950/20 dark:via-card dark:to-card border border-primary/20 shadow-lg">
            {myClasses.length > 0 && currentClass ? (
              <div className="bg-card rounded-2xl p-6 border shadow-md space-y-4">
                {/* Header Kartu + Kontrol Geser / Sliding Kanan Kiri */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Kelas saya</span>
                    {myClasses.length > 1 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {activeSlide + 1} dari {myClasses.length}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {myClasses.length > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setActiveSlide((prev) => (prev > 0 ? prev - 1 : myClasses.length - 1))}
                          className="p-1 rounded-lg border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Kelas sebelumnya"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSlide((prev) => (prev < myClasses.length - 1 ? prev + 1 : 0))}
                          className="p-1 rounded-lg border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Kelas berikutnya"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      currentEnrollment.status === "paid"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                    }`}>
                      {currentEnrollment.status === "paid" ? "Sedang Berjalan" : "Menunggu Verifikasi"}
                    </span>
                  </div>
                </div>

                {/* Judul Kelas (bisa diklik menuju Kelas Saya) */}
                <div>
                  <Link to="/kelas-saya" className="group block">
                    <h3 className="font-display text-xl sm:text-2xl font-bold text-primary group-hover:underline flex items-center justify-between">
                      <span>{currentClass.name}</span>
                      <ArrowRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </h3>
                  </Link>
                  {currentClass.schedule && (
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                      {currentClass.schedule}
                    </p>
                  )}
                </div>

                {/* Info Paket */}
                {currentEnrollment.status === "paid" && (
                  <div className="rounded-xl bg-muted/60 p-3.5 space-y-1 text-xs sm:text-sm">
                    <p className="font-semibold text-foreground">
                      Paket {packageTitle(currentEnrollment)}
                    </p>
                    {(() => {
                      const end = packageEnd(currentEnrollment);
                      if (end) {
                        const d = daysLeft(end);
                        return (
                          <p className="text-muted-foreground">
                            {d <= 0 ? "Paket sudah habis" : `Sisa ${d} hari lagi`}
                          </p>
                        );
                      }
                      const pkg = currentEnrollment as unknown as { sessions_total?: number | null; sessions_used?: number | null };
                      const total = pkg.sessions_total || 0;
                      const used = pkg.sessions_used || 0;
                      return (
                        <p className="text-muted-foreground">
                          Sisa {Math.max(total - used, 0)} sesi dari {total} sesi
                        </p>
                      );
                    })()}
                  </div>
                )}

                {/* Daftar Pelajaran / Sesi (Sesuai Foto Pratinjau) */}
                <div className="space-y-2 pt-2 border-t border-border/70 text-xs sm:text-sm">
                  {currentSessions.length > 0 ? (
                    currentSessions.slice(0, 3).map((s: any, idx: number) => (
                      <div key={s.id || idx} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                            {s.number || idx + 1}
                          </span>
                          <span className="font-medium text-foreground line-clamp-1">
                            {s.title || `Sesi ${s.number}`}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium shrink-0 ml-2">
                          {s.scheduled_at ? new Date(s.scheduled_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB" : "Tersedia"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-2 text-xs text-muted-foreground flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary shrink-0" />
                      <span>Jadwal & materi sesi lengkap tersedia di halaman Kelas Saya.</span>
                    </div>
                  )}
                </div>

                {/* Tombol Aksi */}
                <div className="pt-2 space-y-2">
                  <Button asChild className="w-full font-bold rounded-xl h-11 shadow-sm">
                    <Link to="/kelas-saya">
                      Buka Kelas Saya <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Link>
                  </Button>

                  {currentPriv?.whatsapp_link && currentEnrollment.status === "paid" && (
                    <Button asChild className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-xl h-10 text-xs sm:text-sm">
                      <a href={currentPriv.whatsapp_link} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-4 w-4 mr-1.5" /> Gabung WhatsApp Kelas
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* Tampilan Pratinjau Alur jika belum login atau belum daftar kelas */
              <div className="bg-card rounded-2xl p-6 border shadow-md space-y-4">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                  <span className="text-muted-foreground">Pratinjau Kelas</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                    Contoh Alur
                  </span>
                </div>

                <div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-primary">
                    Tahsin Dasar — Level 1
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Selasa &amp; Kamis, 19.30 WIB
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full w-[62%] bg-gradient-to-r from-primary to-gold rounded-full" />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Sesi 5 dari 8</span>
                    <b className="text-foreground">62%</b>
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t border-border/70 text-xs sm:text-sm">
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className="font-medium text-foreground">Makhraj huruf hijaiyah</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">Selesai</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Play className="h-3.5 w-3.5 fill-current" />
                      </span>
                      <span className="font-medium text-foreground">Sifat-sifat huruf</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">Rekaman 24 menit</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-lg bg-muted text-muted-foreground text-xs font-bold">
                        3
                      </span>
                      <span className="font-medium text-foreground">Tajwid dasar</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">Selasa, 19.30</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button asChild className="w-full font-bold rounded-xl h-11">
                    <Link to="/kelas">Pilih &amp; Daftar Kelas</Link>
                  </Button>
                </div>
              </div>
            )}

            <div className="hidden sm:block absolute -bottom-3 -right-3 bg-card border rounded-2xl px-4 py-2.5 shadow-lg text-xs font-semibold text-muted-foreground">
              Bisa diulang
              <strong className="block text-sm font-display font-extrabold text-primary">
                Rekaman tiap sesi
              </strong>
            </div>
          </div>
        </section>

        {/* SECTION: PILIH ILMU */}
        <section id="kelas" className="space-y-6 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
                Pilih ilmu yang ingin dipelajari
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Mulai dari bidangnya, lalu pilih kelas dan level yang sesuai kebutuhan.
              </p>
            </div>
            <Link to="/kelas" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
              Lihat semua kelas <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* TAHSIN */}
            <article className="flex flex-col justify-between rounded-2xl border bg-card p-6 shadow-xs hover:border-gold transition-colors">
              <div className="space-y-4">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary border border-gold/40">
                  <GraduationCap className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="font-display text-xl font-bold text-foreground">Tahsin Al-Qur’an</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">
                    {subjects.find((s) => s.slug === "tahsin")?.bio ||
                      "Memperbaiki bacaan dari makhraj, sifat huruf, sampai hukum tajwid, mulai dari nol secara bertahap."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 pt-3 border-t border-border/70 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-gold" /> Materi bertahap
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Video className="h-3.5 w-3.5 text-gold" /> Rekaman sesi
                  </span>
                </div>
              </div>
              <div className="pt-6 mt-auto">
                <Button asChild className="w-full font-bold rounded-xl h-11">
                  <Link to="/ilmu/$slug" params={{ slug: "tahsin" }}>
                    Lihat kelas <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Link>
                </Button>
              </div>
            </article>

            {/* BAHASA */}
            <article className="flex flex-col justify-between rounded-2xl border bg-card p-6 shadow-xs hover:border-gold transition-colors">
              <div className="space-y-4">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary border border-gold/40">
                  <Languages className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="font-display text-xl font-bold text-foreground">Bahasa</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">
                    {subjects.find((s) => s.slug.includes("bahasa"))?.bio ||
                      "Tata bahasa dan percakapan praktis yang dipelajari selangkah demi selangkah untuk pemahaman kosakata."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 pt-3 border-t border-border/70 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-gold" /> Materi bertahap
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5 text-gold" /> Latihan santai
                  </span>
                </div>
              </div>
              <div className="pt-6 mt-auto">
                <Button asChild className="w-full font-bold rounded-xl h-11">
                  <Link
                    to="/ilmu/$slug"
                    params={{
                      slug: subjects.find((s) => s.slug.includes("bahasa"))?.slug || "bahasa-arab",
                    }}
                  >
                    Lihat kelas <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Link>
                </Button>
              </div>
            </article>

            {/* WEBINAR */}
            <article className="flex flex-col justify-between rounded-2xl border bg-card p-6 shadow-xs hover:border-gold transition-colors">
              <div className="space-y-4">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary border border-gold/40">
                  <Video className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="font-display text-xl font-bold text-foreground">Webinar</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">
                    {subjects.find((s) => s.slug === "webinar")?.bio ||
                      "Sesi tematik, workshop intensif, dan tanya jawab langsung bersama narasumber berpengalaman."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 pt-3 border-t border-border/70 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-gold" /> Sesi terjadwal
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-gold" /> Tanya jawab
                  </span>
                </div>
              </div>
              <div className="pt-6 mt-auto">
                <Button asChild className="w-full font-bold rounded-xl h-11">
                  <Link
                    to="/ilmu/$slug"
                    params={{
                      slug: subjects.find((s) => s.slug === "webinar")?.slug || "webinar",
                    }}
                  >
                    Lihat kelas <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Link>
                </Button>
              </div>
            </article>
          </div>
        </section>

        {/* SECTION: BAND CARA BELAJAR */}
        <section
          id="cara"
          className="rounded-3xl bg-primary text-primary-foreground p-7 sm:p-10 relative overflow-hidden shadow-xl"
        >
          <div className="relative z-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
            <div className="space-y-4">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
                Belajar pelan-pelan, tapi pasti.
              </h2>
              <p className="text-sm sm:text-base text-primary-foreground/85 leading-relaxed max-w-lg">
                Setiap sesi membahas satu inti materi secara lugas. Kalau terlewat atau ingin mengulang, rekamannya tersedia. Kalau ada yang belum paham, tanyakan langsung di grup WhatsApp.
              </p>
              <div className="pt-2">
                <Button asChild size="lg" className="bg-background text-foreground hover:bg-card font-bold rounded-xl px-7 shadow-md">
                  <Link to="/kelas">
                    Pilih kelas <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex items-start gap-3 rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-4 text-sm font-semibold">
                <Check className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                <span>Materi ringkas dan bertahap</span>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-4 text-sm font-semibold">
                <Check className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                <span>Rekaman setiap sesi</span>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-4 text-sm font-semibold">
                <Check className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                <span>Pengajar yang sabar</span>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-4 text-sm font-semibold">
                <Check className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                <span>Grup WhatsApp murid</span>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
