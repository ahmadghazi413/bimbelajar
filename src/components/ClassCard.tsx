import { Link } from "@tanstack/react-router";
import { CalendarDays, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rupiah } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

export function ClassCard({ c }: { c: Tables<"classes"> }) {
  return (
    <div className="flex flex-col rounded-3xl border bg-card p-6 shadow-sm">
      <h3 className="text-2xl font-semibold text-primary">{c.name}</h3>
      <p className="mt-1 text-muted-foreground">{c.tagline}</p>
      <ul className="mt-4 space-y-2 text-sm">
        <li className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> {c.levels_label}</li>
        <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> {c.schedule}</li>
        <li className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Kuota {c.quota} orang</li>
      </ul>
      <div className="mt-5 flex items-end gap-1">
        {c.price_prefix && <span className="text-sm text-muted-foreground">{c.price_prefix}</span>}
        <span className="font-display text-3xl font-semibold">{rupiah(c.price)}</span>
        <span className="text-sm text-muted-foreground">/bulan</span>
      </div>
      <Button asChild className="mt-5"><Link to="/kelas/$slug" params={{ slug: c.slug }}>Lihat Detail</Link></Button>
    </div>
  );
}
