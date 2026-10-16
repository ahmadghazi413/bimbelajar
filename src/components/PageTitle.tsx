import type { ReactNode } from "react";

export function Page({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "paid" ? "bg-success text-success-foreground"
    : status === "rejected" ? "bg-destructive text-destructive-foreground"
    : "bg-warning text-warning-foreground";
  const label = status === "paid" ? "Lunas" : status === "rejected" ? "Ditolak" : "Menunggu konfirmasi";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}
