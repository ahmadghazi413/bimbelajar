import { createFileRoute, Link } from "@tanstack/react-router";
import { HeartHandshake, Home, ShieldCheck, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Bimbelajar — Les Ngaji Online dari Nol untuk Dewasa & Ibu-ibu" },
      { name: "description", content: "Belajar membaca Al-Qur'an dari nol, tanpa malu, dibimbing guru yang sabar, langsung dari rumah." },
      { property: "og:title", content: "Bimbelajar — Les Ngaji Online untuk Dewasa" },
      { property: "og:description", content: "Belajar membaca Al-Qur'an dari nol, tanpa malu, dari rumah." },
    ],
  }),
  component: Index,
});

const perks = [
  { icon: ShieldCheck, title: "Belajar tanpa malu", text: "Semua murid mulai dari nol. Tidak ada yang menertawakan, kamera boleh dimatikan." },
  { icon: HeartHandshake, title: "Guru sabar", text: "Dibimbing pelan-pelan, diulang sampai paham. Bertanya kapan saja." },
  { icon: Home, title: "Dari rumah", text: "Cukup HP dan kuota. Belajar lewat Zoom di sela kesibukan." },
  { icon: Video, title: "Ada rekaman", text: "Ketinggalan sesi? Tonton ulang rekamannya kapan pun." },
];

function Index() {
  return (
    <>
      <section className="bg-hero">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 pb-12 pt-8 md:grid-cols-2 md:items-center md:py-16">
          <div>
            <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
              Khusus dewasa & ibu-ibu
            </span>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-foreground md:text-5xl">
              Belajar baca Al-Qur'an <span className="text-primary">dari nol</span>, pelan-pelan dan tenang.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Les ngaji online bersama guru yang sabar. 16 sesi per level, mulai dari mengenal huruf hijaiyah hingga lancar membaca.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="hero" size="lg"><Link to="/auth">Daftar Sekarang</Link></Button>
              <Button asChild variant="outline" size="lg"><Link to="/kelas">Lihat Kelas</Link></Button>
            </div>
          </div>
          <img src={hero} alt="Ibu belajar membaca Al-Qur'an lewat video call" width={1024} height={1024}
            className="aspect-square w-full rounded-3xl object-cover shadow-soft" />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-center text-3xl font-semibold">Kenapa Bimbelajar?</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {perks.map((p) => (
            <div key={p.title} className="flex gap-4 rounded-2xl border bg-card p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                <p.icon className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="mt-1 text-muted-foreground">{p.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="rounded-3xl bg-brand p-8 text-center text-primary-foreground">
          <h2 className="text-2xl font-semibold">Siap memulai?</h2>
          <p className="mt-2 opacity-90">Pilih kelas yang paling nyaman untuk Anda.</p>
          <Button asChild variant="secondary" size="lg" className="mt-5"><Link to="/kelas">Lihat Kelas</Link></Button>
        </div>
      </section>
    </>
  );
}
