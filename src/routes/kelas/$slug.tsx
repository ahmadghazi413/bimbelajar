import { ArrowLeft, CalendarDays, Clock3, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { TeacherIdentity } from "@/components/TeacherIdentity";
import { packageUnit, rupiah } from "@/lib/format";

export function ClassDetailPage({ c }: { c: any }) {
  const targetGender = c.target_gender;
  const genderLabel = targetGender === "ikhwan" ? "Ikhwan · Laki-laki" : targetGender === "akhwat" ? "Akhwat · Perempuan" : null;
  const regularPrice = Number(c.price_normal ?? c.price ?? 0);
  const promoPrice = Number(c.price_promo ?? 0);
  const finalPrice = promoPrice > 0 ? promoPrice : regularPrice;
  const hasPromo = promoPrice > 0 && promoPrice < regularPrice;

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
            Level {c.level_number} · {c.level_label}
          </span>
          {genderLabel && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${targetGender === "akhwat" ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"}`}>
              {genderLabel}
            </span>
          )}
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-primary sm:text-4xl">{c.name}</h1>
        {c.tagline && <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">{c.tagline}</p>}
        <div className="mt-4"><TeacherIdentity teacherId={c.teacher_id} /></div>
      </div>

      <aside className="rounded-3xl border bg-card p-5 shadow-sm lg:sticky lg:top-24">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Investasi belajar</p>
        <p className="mt-2 font-display text-3xl font-bold text-primary">
          {c.price_prefix && <span className="mr-1 text-xs font-medium text-muted-foreground">{c.price_prefix}</span>}
          {hasPromo ? (
            <>
              <span className="mr-2 text-base font-medium text-muted-foreground line-through">{rupiah(regularPrice)}</span>
              <span>{rupiah(finalPrice)}</span>
            </>
          ) : (
            <span>{rupiah(regularPrice)}</span>
          )}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">per {packageUnit(c)}</p>
        <div className="my-4 border-t" />
        <div className="space-y-3 text-sm">
          <p className="flex items-start gap-2.5"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{c.schedule}</span></p>
          <p className="flex items-center gap-2.5"><Users className="h-4 w-4 shrink-0 text-primary" /><span>Kuota {c.quota || 15} santri</span></p>
          <p className="flex items-center gap-2.5"><Clock3 className="h-4 w-4 shrink-0 text-primary" /><span>{c.levels_label}</span></p>
        </div>
        <Button asChild variant="hero" size="lg" className="mt-5 w-full text-base">
          <Link to="/bayar/$slug" params={{ slug: c.slug }}>Daftar kelas</Link>
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">Pendaftaran aman dan mudah</p>
      </aside>
    </div>
  );
}


























