import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, CalendarDays, ChevronDown, GraduationCap, Gift, Megaphone, Settings, Ticket, UserCheck, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { settingsQuery } from "@/lib/queries";
import { parseTeachers } from "@/lib/teachers";
import { ReferralSettings } from "@/components/ReferralSettings";
import { PesertaTab } from "@/components/admin/PesertaTab";
import { KelasTab } from "@/components/admin/KelasTab";
import { IlmuTab } from "@/components/admin/IlmuTab";
import { SesiTab } from "@/components/admin/SesiTab";
import { VoucherTab } from "@/components/admin/VoucherTab";
import { PengajarTab } from "@/components/admin/PengajarTab";
import { PengumumanTab } from "@/components/admin/PengumumanTab";
import { PengaturanTab } from "@/components/admin/PengaturanTab";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

const ADMIN_TABS = [
  { v: "peserta", l: "Peserta", icon: Users },
  { v: "kelas", l: "Kelas", icon: BookOpen },
  { v: "ilmu", l: "Ilmu", icon: GraduationCap },
  { v: "sesi", l: "Sesi & Nilai", icon: CalendarDays },
  { v: "voucher", l: "Voucher", icon: Ticket },
  { v: "referral", l: "Referral", icon: Gift },
  { v: "pengajar", l: "Pengajar", icon: UserCheck },
  { v: "pengumuman", l: "Pengumuman", icon: Megaphone },
  { v: "pengaturan", l: "Pengaturan", icon: Settings },
] as const;

type AdminTab = (typeof ADMIN_TABS)[number]["v"];

function AdminPage() {
  const { session, isAdmin, loading } = useAuth();
  const { data: settings, isPending } = useQuery(settingsQuery);
  const [tab, setTab] = useState<AdminTab>("peserta");
  const [menuOpen, setMenuOpen] = useState(false);
  if (loading || isPending) return <p className="p-6">Memuat...</p>;

  const email = session?.user?.email?.toLowerCase();
  const teacher = parseTeachers(settings?.["teacher_list"]).find((t) => t.email.toLowerCase() === email);

  if (!isAdmin && !teacher) {
    return <div className="mx-auto max-w-3xl px-4 py-10"><p className="text-muted-foreground">Halaman ini hanya untuk admin dan pengajar.</p></div>;
  }

    // Panel Guru: otomatis mengambil kelas yang ditugaskan ke guru ini
  if (!isAdmin && teacher) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">Panel Guru</h1>
        <SesiTab teacherId={teacher.id} allowAll={teacher.allClasses} />
      </div>
    );
  }

  const current = ADMIN_TABS.find((t) => t.v === tab) ?? ADMIN_TABS[0];
  const CurrentIcon = current.icon;
  const itemCls = (on: boolean) =>
    `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
      on ? "bg-primary/10 font-semibold text-primary" : "text-foreground/80 hover:bg-secondary"
    }`;
  const menuItems = ADMIN_TABS.map((t) => {
    const Icon = t.icon;
    return (
      <button
        key={t.v}
        type="button"
        onClick={() => {
          setTab(t.v);
          setMenuOpen(false);
        }}
        className={itemCls(t.v === tab)}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {t.l}
      </button>
    );
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Panel Admin</h1>
      <div className="md:flex md:items-start md:gap-6">
        {/* HP: tombol menu yang membuka daftar ke bawah */}
        <div className="mb-4 md:hidden">
          <button
            type="button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left font-semibold"
          >
            <CurrentIcon className="h-5 w-5 text-primary" />
            <span className="flex-1">{current.l}</span>
            <ChevronDown className={`h-5 w-5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>
          {menuOpen && <nav className="mt-2 space-y-1 rounded-2xl border bg-card p-2">{menuItems}</nav>}
        </div>

        {/* Laptop: menu tetap di sisi kiri */}
        <nav className="hidden w-52 shrink-0 space-y-1 rounded-2xl border bg-card p-2 md:sticky md:top-4 md:block">{menuItems}</nav>

        <div className="min-w-0 flex-1">
          {tab === "peserta" && <PesertaTab />}
          {tab === "kelas" && <KelasTab />}
          {tab === "ilmu" && <IlmuTab />}
          {tab === "sesi" && <SesiTab allowedClassIds="all" />}
          {tab === "voucher" && <VoucherTab />}
          {tab === "referral" && <ReferralSettings />}
          {tab === "pengajar" && <PengajarTab />}
          {tab === "pengumuman" && <PengumumanTab />}
          {tab === "pengaturan" && <PengaturanTab />}
        </div>
      </div>
    </div>
  );
}
