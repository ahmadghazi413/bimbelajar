import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, CalendarDays, Megaphone, TriangleAlert } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { tanggal } from "@/lib/format";
import { useNotifications, type AppNotification } from "@/lib/notifications";

function NotifIcon({ kind }: { kind: AppNotification["kind"] }) {
  if (kind === "today") return <CalendarDays className="h-5 w-5 shrink-0 text-primary" />;
  if (kind === "announcement") return <Megaphone className="h-5 w-5 shrink-0 text-primary" />;
  return <TriangleAlert className="h-5 w-5 shrink-0 text-destructive" />;
}

export function NotificationBell() {
  const { items, unread, seen, markAllSeen } = useNotifications();
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (o) {
      setFresh(new Set(items.filter((i) => !seen.has(i.key)).map((i) => i.key)));
      markAllSeen();
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifikasi" className="relative">
          <Bell className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-primary">Notifikasi</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {items.length === 0 && <p className="text-sm text-muted-foreground">Belum ada notifikasi.</p>}
          {items.map((n) => {
            const card = (
              <div className="flex gap-3 rounded-2xl border bg-card p-3">
                <NotifIcon kind={n.kind} />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold">
                    {n.title}
                    {fresh.has(n.key) && (
                      <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">Baru</span>
                    )}
                  </p>
                  {n.body && <p className="whitespace-pre-line break-words text-sm text-muted-foreground">{n.body}</p>}
                  {n.date && <p className="text-xs text-muted-foreground">{tanggal(n.date)}</p>}
                </div>
              </div>
            );
            return n.kind === "announcement" ? (
              <div key={n.key}>{card}</div>
            ) : (
              <Link key={n.key} to="/kelas-saya" onClick={() => setOpen(false)} className="block">
                {card}
              </Link>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
