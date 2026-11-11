import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { settingsQuery } from "@/lib/queries";
import { parseTeachers } from "@/lib/teachers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  { v: "peserta", l: "Peserta" },
  { v: "kelas", l: "Kelas" },
  { v: "ilmu", l: "Ilmu" },
  { v: "sesi", l: "Sesi & Nilai" },
  { v: "voucher", l: "Voucher" },
  { v: "referral", l: "Referral" },
  { v: "pengajar", l: "Pengajar" },
  { v: "pengumuman", l: "Pengumuman" },
  { v: "pengaturan", l: "Pengaturan" },
] as const;

function AdminPage() {
  const { session, isAdmin, loading } = useAuth();
  const { data: settings, isPending } = useQuery(settingsQuery);
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Panel Admin</h1>
      <Tabs defaultValue="peserta">
        <TabsList className="mb-4 flex h-auto w-full justify-start gap-1 overflow-x-auto">
          {ADMIN_TABS.map((t) => <TabsTrigger key={t.v} value={t.v} className="shrink-0">{t.l}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="peserta"><PesertaTab /></TabsContent>
        <TabsContent value="kelas"><KelasTab /></TabsContent>
        <TabsContent value="ilmu"><IlmuTab /></TabsContent>
        <TabsContent value="sesi"><SesiTab allowedClassIds="all" /></TabsContent>
        <TabsContent value="voucher"><VoucherTab /></TabsContent>
        <TabsContent value="referral"><ReferralSettings /></TabsContent>
        <TabsContent value="pengajar"><PengajarTab /></TabsContent>
        <TabsContent value="pengumuman"><PengumumanTab /></TabsContent>
        <TabsContent value="pengaturan"><PengaturanTab /></TabsContent>
      </Tabs>
    </div>
  );
}
