import { GraduationCap, CalendarDays, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { packageUnit, rupiah } from "@/lib/format";
import { TeacherIdentity } from "@/components/TeacherIdentity";

export function ClassCard({ c }: { c: any }) {
  const targetGender = c.target_gender;
  const genderLabel = targetGender === "ikhwan" ? "Ikhwan · Laki-laki" : targetGender === "akhwat" ? "Akhwat · Perempuan" : null;
  const regularPrice = Number(c.price_normal ?? c.price ?? 0);
  const promoPrice = Number(c.price_promo ?? 0);
  const finalPrice = promoPrice > 0 ? promoPrice : regularPrice;
  const hasPromo = promoPrice > 0 && promoPrice < regularPrice;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="h-1.5 bg-gradient-to-r from-primary via-primary/70 to-primary/20" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-xl font-bold leading-snug text-primary sm:text-2xl">{c.name}</h3>
          {genderLabel && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                targetGender === "akhwat"
                  ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                  : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
              }`}
            >
              {genderLabel}
            </span>
          )}
        </div>
        {c.tagline && <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground">{c.tagline}</p>}
        <div className="mt-4"><TeacherIdentity teacherId={c.teacher_id} /></div>

        <ul className="mt-5 space-y-3 border-t pt-4 text-sm">
          <li className="flex items-start gap-2.5 text-foreground/90">
            <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{c.levels_label}</span>
          </li>
          <li className="flex items-start gap-2.5 text-foreground/90">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{c.schedule}</span>
          </li>
          <li className="flex items-center gap-2.5 text-foreground/90">
            <Users className="h-4 w-4 shrink-0 text-primary" />
            <span>Kuota {c.quota} orang</span>
          </li>
        </ul>

        <div className="mt-auto pt-6">
          <p className="text-xs font-medium text-muted-foreground">Investasi belajar</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            {c.price_prefix && <span className="text-sm text-muted-foreground">{c.price_prefix}</span>}
            {hasPromo ? (
              <>
                <span className="text-sm text-muted-foreground line-through">{rupiah(regularPrice)}</span>
                <span className="font-display text-2xl font-bold text-foreground sm:text-3xl">{rupiah(finalPrice)}</span>
              </>
            ) : (
              <span className="font-display text-2xl font-bold text-foreground sm:text-3xl">{rupiah(regularPrice)}</span>
            )}
            <span className="text-sm text-muted-foreground">/{packageUnit(c)}</span>
          </div>
          <Button asChild className="mt-4 w-full rounded-xl font-semibold transition-transform group-hover:translate-y-0">
            <Link to="/kelas/$slug" params={{ slug: c.slug }}>Lihat detail kelas</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}


























































