import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { Tables } from "@/integrations/supabase/types";

export function SessionList({ sessions }: { sessions: Tables<"class_sessions">[] }) {
  const levels = [...new Set(sessions.map((s) => s.level))].sort();
  return (
    <Accordion type="single" collapsible defaultValue={`l${levels[0]}`} className="space-y-3">
      {levels.map((lv) => {
        const list = sessions.filter((s) => s.level === lv);
        return (
          <AccordionItem key={lv} value={`l${lv}`} className="rounded-2xl border bg-card px-4">
            <AccordionTrigger className="text-lg font-semibold">Level {lv} · {list.length} sesi</AccordionTrigger>
            <AccordionContent>
              <ol className="space-y-3">
                {list.map((s) => (
                  <li key={s.id} className="flex gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-primary">{s.number}</span>
                    <div>
                      <p className="font-medium">{s.title}</p>
                      <p className="text-sm text-muted-foreground">{s.description}</p>
                      {s.scheduled_at && <p className="text-xs text-primary">{s.scheduled_at}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
