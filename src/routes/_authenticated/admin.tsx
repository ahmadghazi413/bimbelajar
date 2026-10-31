import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { packageUnit, rupiah, tanggal } from "@/lib/format";
import { Page, StatusBadge } from "@/components/PageTitle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReferralSettings } from "@/components/ReferralSettings";
import { AdminDelete } from "@/components/AdminDelete";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { classesInSubject, classLevelName } from "@/lib/class-management";
import { settingsQuery } from "@/lib/queries";
import { PaymentProof } from "@/components/PaymentProof";
import { FILE_MAX_BYTES, fileExt, openPrivateFile } from "@/lib/session-content";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Panel Admin — Bimbelajar" },
      { name: "description", content: "Kelola kelas, peserta, voucher dan program referral Bimbelajar." },
      { property: "og:title", content: "Panel Admin — Bimbelajar" },
      { property: "og:description", content: "Kelola kelas, peserta, voucher dan program referral Bimbelajar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Admin,
});

function useClasses() {
  return useQuery({
    queryKey: ["admin-classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

function useSubjects() {
  return useQuery({
    queryKey: ["admin-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

function SubjectPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: subjects } = useSubjects();
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">Pilih ilmu / kategori</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-80">
          <SelectValue placeholder="Pilih ilmu..." />
        </SelectTrigger>
        <SelectContent>
          {subjects?.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Admin() {
  const { session, isAdmin, loading } = useAuth();
  const { data: settings } = useQuery(settingsQuery);

  // Daftar pengajar yang didaftarkan oleh admin
  const teacherList: { email: string; name: string }[] = (() => {
    try {
      return settings?.["teacher_list"] ? JSON.parse(settings["teacher_list"]) : [];
    } catch {
      return [];
    }
  })();

  const userEmail = session?.user?.email?.toLowerCase();
  const isTeacher = teacherList.some((t) => t.email?.toLowerCase() === userEmail);

  if (loading) return <Page title="Panel Akses">Memuat...</Page>;

  // Jika bukan admin dan bukan pengajar yang terdaftar
  if (!isAdmin && !isTeacher) {
    return (
      <Page title="Akses Ditolak">
        <div className="rounded-xl border bg-card p-6 text-center">
          <p className="text-muted-foreground mb-2">Halaman ini khusus untuk Pengajar dan Administrator.</p>
          <p className="text-xs text-muted-foreground">Hubungi Admin jika akun pengajar Anda belum didaftarkan.</p>
        </div>
      </Page>
    );
  }

  // TAMPILAN KHUSUS GURU: Hanya melihat Sesi & Tugas/Nilai
  if (!isAdmin && isTeacher) {
    return (
      <Page title="Panel Guru / Pengajar">
        <div className="mb-4 rounded-xl border bg-primary/5 p-4 text-xs text-primary">
          Anda masuk sebagai <strong>Pengajar</strong>. Anda memiliki akses untuk mengelola jadwal sesi pertemuan Zoom, tautan rekaman YouTube, tugas/PDF, serta menginput nilai santri melalui tombol <strong>Tugas &amp; nilai</strong> pada tiap sesi.
        </div>
        <Tabs defaultValue="sesi">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="sesi">Sesi Kelas &amp; Input Nilai</TabsTrigger>
          </TabsList>
          <TabsContent value="sesi">
            <KelolaSesi />
          </TabsContent>
        </Tabs>
      </Page>
    );
  }

  // TAMPILAN ADMIN LENGKAP
  return (
    <Page title="Panel Admin">
      <Tabs defaultValue="dash">
        <TabsList className="flex h-auto w-full flex-wrap">
          <TabsTrigger value="dash">Ringkas</TabsTrigger>
          <TabsTrigger value="kelas">Kelas</TabsTrigger>
          <TabsTrigger value="ilmu">Ilmu</TabsTrigger>
          <TabsTrigger value="sesi">Sesi</TabsTrigger>
          <TabsTrigger value="peserta">Peserta</TabsTrigger>
          <TabsTrigger value="pengajar">Pengajar</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="voucher">Voucher</TabsTrigger>
          <TabsTrigger value="referral">Referral</TabsTrigger>
          <TabsTrigger value="atur">Pengaturan</TabsTrigger>
        </TabsList>
        <TabsContent value="dash"><Dashboard /></TabsContent>
        <TabsContent value="kelas"><KelolaKelas /></TabsContent>
        <TabsContent value="ilmu"><KelolaIlmu /></TabsContent>
        <TabsContent value="sesi"><KelolaSesi /></TabsContent>
        <TabsContent value="peserta"><Peserta /></TabsContent>
        <TabsContent value="pengajar"><KelolaPengajar /></TabsContent>
        <TabsContent value="info"><KelolaInfo /></TabsContent>
        <TabsContent value="voucher"><KelolaVoucher /></TabsContent>
        <TabsContent value="referral"><ReferralSettings /></TabsContent>
        <TabsContent value="atur"><Pengaturan /></TabsContent>
      </Tabs>
    </Page>
  );
}

function KelolaPengajar() {
  const qc = useQueryClient();
  const { data: settings } = useQuery(settingsQuery);
  const { data: classes } = useClasses();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [classId, setClassId] = useState("");
  const [busy, setBusy] = useState(false);

  const teacherList: { id: string; name: string; email: string; classId?: string; createdAt: string }[] =
    (() => {
      try {
        return settings?.["teacher_list"] ? JSON.parse(settings["teacher_list"]) : [];
      } catch {
        return [];
      }
    })();

  async function addTeacher(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !name.trim()) {
      toast.error("Nama dan email pengajar wajib diisi.");
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (teacherList.some((t) => t.email.toLowerCase() === cleanEmail)) {
      toast.error("Email pengajar ini sudah terdaftar.");
      return;
    }

    setBusy(true);
    const updated = [
      ...teacherList,
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        email: cleanEmail,
        classId: classId && classId !== "all" ? classId : undefined,
        createdAt: new Date().toISOString(),
      },
    ];

    const { error } = await supabase.from("settings").upsert({
      key: "teacher_list",
      value: JSON.stringify(updated),
    });

    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Pengajar ${name} berhasil didaftarkan!`);
    setName("");
    setEmail("");
    setClassId("");
    qc.invalidateQueries({ queryKey: ["settings"] });
  }

  async function removeTeacher(id: string) {
    if (!confirm("Hapus akses pengajar ini?")) return;
    const updated = teacherList.filter((t) => t.id !== id);
    const { error } = await supabase.from("settings").upsert({
      key: "teacher_list",
      value: JSON.stringify(updated),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Akses pengajar dihapus.");
    qc.invalidateQueries({ queryKey: ["settings"] });
  }

  return (
    <div className="mt-4 space-y-6">
      <div className="rounded-xl border bg-card p-4">
        <h3 className="font-semibold text-lg mb-1">Daftarkan Pengajar / Guru Baru</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Pengajar yang didaftarkan di sini hanya dapat membuka <strong>Section Sesi</strong> dan <strong>Input Nilai Santri</strong>, tanpa akses ke data keuangan, peserta, maupun pengaturan website.
        </p>
        <form onSubmit={addTeacher} className="space-y-3">
          <div>
            <Label>Nama Lengkap Pengajar</Label>
            <Input
              placeholder="Contoh: Ustadz Ahmad / Ustadzah Fulanah"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Email Akun Pengajar</Label>
            <Input
              type="email"
              placeholder="emailpengajar@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Pastikan pengajar mendaftar atau masuk dengan alamat email ini.
            </p>
          </div>
          <div>
            <Label>Kelas yang Diampu (Opsional)</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Kelas / Pilih Kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {classes?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Menyimpan..." : "+ Tambahkan Pengajar"}
          </Button>
        </form>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="font-semibold text-base mb-3">Daftar Pengajar Aktif ({teacherList.length})</h3>
        {teacherList.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada pengajar yang didaftarkan.</p>
        ) : (
          <div className="divide-y">
            {teacherList.map((t) => {
              const assignedClass = classes?.find((c) => c.id === t.classId);
              return (
                <div key={t.id} className="py-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.email}</div>
                    <div className="text-xs text-primary mt-0.5">
                      Pengampu: {assignedClass ? assignedClass.title : "Semua Kelas"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => removeTeacher(t.id)}
                  >
                    Hapus
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

type InfoRow = { id: string; title: string; body: string; is_active: boolean; created_at: string };

function KelolaInfo() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InfoRow[];
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("announcements").insert({ title: title.trim(), body: body.trim() });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pengumuman ditambahkan.");
    setTitle("");
    setBody("");
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
  }

  async function toggle(id: string, active: boolean) {
    const { error } = await supabase.from("announcements").update({ is_active: !active }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
  }

  async function remove(id: string) {
    if (!confirm("Hapus pengumuman ini?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
  }

  return (
    <div className="mt-4 space-y-4">
      <form onSubmit={add} className="rounded-2xl border p-4 space-y-3">
        <h3 className="font-semibold text-sm">Tambah pengumuman</h3>
        <div>
          <Label>Judul</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label>Isi pengumuman</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} required />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Menyimpan..." : "Kirim pengumuman"}
        </Button>
      </form>

      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Daftar pengumuman</h3>
        {data?.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pengumuman.</p>}
        {data?.map((a) => (
          <div key={a.id} className="rounded-xl border p-3 flex items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{a.title}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {a.is_active ? "Aktif" : "Nonaktif"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.body}</p>
              <div className="text-[10px] text-muted-foreground">{tanggal(a.created_at)}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => toggle(a.id, a.is_active)}>
                {a.is_active ? "Matikan" : "Aktifkan"}
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(a.id)}>
                Hapus
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  const { data: enr } = useQuery({
    queryKey: ["admin-dash-enr"],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments").select("amount_paid, status");
      return data ?? [];
    },
  });
  const paid = (enr ?? []).filter((x) => x.status === "paid");
  const pending = (enr ?? []).filter((x) => x.status === "pending");
  const omzet = paid.reduce((acc, x) => acc + (x.amount_paid ?? 0), 0);

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border p-4">
        <div className="text-xs text-muted-foreground">Peserta lunas</div>
        <div className="text-2xl font-bold text-primary">{paid.length}</div>
      </div>
      <div className="rounded-2xl border p-4">
        <div className="text-xs text-muted-foreground">Menunggu konfirmasi</div>
        <div className="text-2xl font-bold text-amber-600">{pending.length}</div>
      </div>
      <div className="rounded-2xl border p-4">
        <div className="text-xs text-muted-foreground">Total omzet</div>
        <div className="text-2xl font-bold text-primary">{rupiah(omzet)}</div>
      </div>
    </div>
  );
}

function KelolaKelas() {
  const qc = useQueryClient();
  const { data } = useClasses();
  const { data: subjects } = useSubjects();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<"classes"> | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState(150000);
  const [pricePerSession, setPricePerSession] = useState(20000);
  const [schedule, setSchedule] = useState("");
  const [zoom, setZoom] = useState("");
  const [wa, setWa] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [levelNum, setLevelNum] = useState(1);
  const [highlights, setHighlights] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  function startAdd() {
    setEditing(null);
    setTitle("");
    setSlug("");
    setDesc("");
    setPrice(150000);
    setPricePerSession(20000);
    setSchedule("Senin & Kamis, 20.00 WIB");
    setZoom("");
    setWa("");
    setSubjectId(subjects?.[0]?.id ?? "");
    setLevelNum(1);
    setHighlights("");
    setActive(true);
    setOpen(true);
  }

  async function startEdit(c: Tables<"classes">) {
    setEditing(c);
    setTitle(c.title);
    setSlug(c.slug);
    setDesc(c.description);
    setPrice(c.price);
    setPricePerSession((c as any).price_per_session ?? Math.round(c.price / 8));
    setSchedule(c.schedule_text);
    setSubjectId(c.subject_id ?? subjects?.[0]?.id ?? "");
    setLevelNum(c.level_number ?? 1);
    setHighlights((c.highlights ?? []).join("\n"));
    setActive(c.is_active);
    const { data: priv } = await (supabase as any).from("class_private").select("*").eq("class_id", c.id).maybeSingle();
    setZoom(priv?.zoom_link ?? "");
    setWa(priv?.whatsapp_group_link ?? "");
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const hl = highlights.split("\n").map((x) => x.trim()).filter(Boolean);
    const payload = {
      title,
      slug,
      description: desc,
      price: Number(price),
      price_per_session: Number(pricePerSession) || Math.round(Number(price) / 8),
      schedule_text: schedule,
      subject_id: subjectId || null,
      level_number: Number(levelNum),
      highlights: hl,
      is_active: active,
    };
    try {
      let classId = editing?.id;
      if (editing) {
        const { error } = await supabase.from("classes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: ins, error } = await supabase.from("classes").insert(payload).select().single();
        if (error) throw error;
        classId = ins.id;
      }
      if (classId) {
        await (supabase as any).from("class_private").upsert({
          class_id: classId,
          zoom_link: zoom,
          whatsapp_group_link: wa,
        });
      }
      toast.success("Kelas disim
