import { Link } from "@tanstack/react-router";
import { CalendarDays, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { rupiah } from "@/lib/format";
import { startingPrice } from "@/lib/package-prices";
import type { ClassGroup } from "@/lib/class-groups";
import { categoryLabel, scheduleLines } from "@/lib/class-category";

export function ProgramCarousel({ groups, id, showCategory }: { groups: ClassGroup[]; id: string; showCategory: boolean }) {
  if (groups.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed bg-card p-6 text-center">
        <p className="font-semibold text-foreground">Belum ada program di sini</p>
        <p className="mt-1 text-sm text-muted-foreground">Cek kembali nanti.</p>
      </div>
    );
  }
  return (
    <>
      <Carousel key={id} opts={{ align: "start", slidesToScroll: 1, containScroll: "trimSnaps" }} className="mt-4 px-0 sm:px-6">
        <CarouselContent className="-ml-4">
          {groups.map((group) => (
            <CarouselItem key={group.rombels[0].id} className="basis-[88%] pl-4 sm:basis-1/2 lg:basis-1/3">
              <div className="h-full [&>div]:h-full">
                <ProgramCard group={group} showCategory={showCategory} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {groups.length > 1 && (
          <>
            <CarouselPrevious aria-label="Program sebelumnya" className="-left-1 hidden h-9 w-9 sm:inline-flex" />
            <CarouselNext aria-label="Program berikutnya" className="-right-1 hidden h-9 w-9 sm:inline-flex" />
          </>
        )}
      </Carousel>
      {groups.length > 1 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Geser ke samping untuk melihat program lainnya <span aria-hidden="true">→</span>
        </p>
      )}
    </>
  );
}

function ProgramCard({ group, showCategory }: { group: ClassGroup; showCategory: boolean }) {
  const c = group.rombels[0];
  const rombelCount = group.rombels.length;
  const targetGender = c.target_gender;
  const genderLabel = targetGender === "ikhwan" ? "Ikhwan · Laki-laki" : targetGender === "akhwat" ? "Akhwat · Perempuan" : null;
  const start = startingPrice(c);
  const regularPrice = start?.normal ?? 0;
  const hasPromo = !!start?.hasPromo;
  const finalPrice = start?.final ?? 0;
  const lines = scheduleLines(group.rombels);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="h-1.5 bg-gradient-to-r from-primary via-primary/70 to-primary/20" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-xl font-bold leading-snug text-primary sm:text-2xl">{group.cleanName}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {genderLabel && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                targetGender === "akhwat" ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
              }`}
            >
              {genderLabel}
            </span>
          )}
          {showCategory && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">{categoryLabel(c)}</span>
          )}
        </div>

        <ul className="mt-4 space-y-2.5 border-t pt-4 text-sm">
          {(lines.length ? lines : ["Jadwal belum ditentukan"]).map((t) => (
            <li key={t} className="flex items-start gap-2.5 font-medium text-foreground">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{t}</span>
            </li>
          ))}
          <li className="flex items-center gap-2.5 text-foreground/90">
            <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{rombelCount > 1 ? `Kuota ~${c.quota || 15} santri per kelas` : `Kuota ${c.quota || 15} santri`}</span>
          </li>
        </ul>

        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            {(c.price_prefix || (start && "Mulai")) && <span className="text-sm text-muted-foreground">{c.price_prefix || "Mulai"}</span>}
            {hasPromo ? (
              <>
                <span className="text-sm text-muted-foreground line-through">{rupiah(regularPrice)}</span>
                <span className="font-display text-2xl font-bold text-foreground sm:text-3xl">{rupiah(finalPrice)}</span>
              </>
            ) : (
              <span className="font-display text-2xl font-bold text-foreground sm:text-3xl">{rupiah(regularPrice)}</span>
            )}
            <span className="text-sm text-muted-foreground">/{start?.label ?? "paket"}</span>
          </div>
          <Button asChild className="mt-4 w-full rounded-xl font-semibold">
            <Link to="/kelas/$slug" params={{ slug: c.slug }}>Lihat detail kelas</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
