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
      toast.success("Kelas disimpan.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-classes"] });
    } catch (err: any) {
      toast.error(err.message ?? "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <Button onClick={startAdd}>+ Tambah kelas</Button>
      <div className="divide-y rounded-2xl border">
        {data?.map((c) => (
          <div key={c.id} className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">{c.title}</div>
              <div className="text-xs text-muted-foreground">
                {rupiah(c.price)}/bln · {rupiah((c as any).price_per_session ?? Math.round(c.price / 8))}/sesi · {c.schedule_text} · {c.is_active ? "Aktif" : "Nonaktif"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                Ubah
              </Button>
              <AdminDelete
                table="classes"
                id={c.id}
                label={c.title}
                guardMessage="Kelas yang sudah memiliki pendaftar tidak dapat dihapus."
                onDeleted={() => qc.invalidateQueries({ queryKey: ["admin-classes"] })}
              />
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Kelas" : "Tambah Kelas"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div>
              <Label>Judul</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label>Slug URL</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} required />
            </div>
            <div>
              <Label>Ilmu / Kategori</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger>
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
            <div>
              <Label>Tingkat / Level</Label>
              <Select value={String(levelNum)} onValueChange={(v) => setLevelNum(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Level 1 — {classLevelName(1)}</SelectItem>
                  <SelectItem value="2">Level 2 — {classLevelName(2)}</SelectItem>
                  <SelectItem value="3">Level 3 — {classLevelName(3)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Harga Paket Bulanan (Rp)</Label>
                <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} required />
              </div>
              <div>
                <Label>Harga Per Sesi (Rp)</Label>
                <Input type="number" value={pricePerSession} onChange={(e) => setPricePerSession(Number(e.target.value))} required />
              </div>
            </div>
            <div>
              <Label>Jadwal</Label>
              <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} />
            </div>
            <div>
              <Label>Keunggulan (satu per baris)</Label>
              <Textarea
                value={highlights}
                onChange={(e) => setHighlights(e.target.value)}
                placeholder={"Bimbingan dari nol\nRekaman bisa diulang\nKonsultasi fleksibel"}
                rows={3}
              />
            </div>
            <div>
              <Label>Link Zoom (hanya murid lunas)</Label>
              <Input value={zoom} onChange={(e) => setZoom(e.target.value)} placeholder="https://zoom.us/j/..." />
            </div>
            <div>
              <Label>Link Grup WA (hanya murid lunas)</Label>
              <Input value={wa} onChange={(e) => setWa(e.target.value)} placeholder="https://chat.whatsapp.com/..." />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label>Tampilkan di katalog</Label>
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Menyimpan..." : "Simpan"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClassPicker({ value, onChange, subjectId }: { value: string; onChange: (v: string) => void; subjectId?: string }) {
  const { data: classes } = useClasses();
  const filtered = subjectId ? classesInSubject(classes ?? [], subjectId) : classes ?? [];
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">Pilih kelas</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-80">
          <SelectValue placeholder="Pilih kelas..." />
        </SelectTrigger>
        <SelectContent>
          {filtered.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function KelolaSesi() {
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const qc = useQueryClient();
  const { data, refetch } = useQuery({
    queryKey: ["admin-sesi", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data: s, error } = await supabase.from("class_sessions").select("*").eq("class_id", classId).order("level").order("number");
      if (error) throw error;
      const { data: r } = await supabase.from("session_recordings").select("*").eq("class_id", classId);
      const { data: pv } = await (supabase as any).from("session_private").select("*").eq("class_id", classId);
      return (s ?? []).map((x) => {
        const priv = (pv ?? []).find((y: any) => y.session_id === x.id);
        return {
          ...x,
          video_url: r?.find((y) => y.session_id === x.id)?.video_url ?? "",
          zoom_link: (priv?.zoom_link ?? "") as string,
          material_path: (priv?.material_path ?? "") as string,
          material_name: (priv?.material_name ?? "") as string,
        };
      });
    },
  });

  async function addSession() {
    const last = data?.at(-1);
    const level = last ? (last.number >= 16 ? last.level + 1 : last.level) : 1;
    const number = last ? (last.number >= 16 ? 1 : last.number + 1) : 1;
    const { error } = await supabase.from("class_sessions").insert({ class_id: classId, level, number, title: "Sesi baru", is_published: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    await refetch();
    qc.invalidateQueries();
  }

  return (
    <div className="mt-4 space-y-3">
      <SubjectPicker
        value={subjectId}
        onChange={(v) => {
          setSubjectId(v);
          setClassId("");
        }}
      />
      <ClassPicker value={classId} onChange={setClassId} subjectId={subjectId} />
      {classId && data?.length === 0 && <p className="text-muted-foreground">Belum ada sesi.</p>}
      {data?.map((s) => (
        <SessionRow
          key={s.id}
          s={s}
          classId={classId}
          onSaved={async () => {
            await refetch();
          }}
        />
      ))}
      {classId && (
        <Button variant="outline" onClick={addSession}>
          + Tambah sesi
        </Button>
      )}
    </div>
  );
}

function SessionRow({
  s,
  classId,
  onSaved,
}: {
  s: {
    id: string;
    level: number;
    number: number;
    title: string;
    description: string | null;
    is_published: boolean;
    video_url: string;
    zoom_link: string;
    material_path: string;
    material_name: string;
  };
  classId: string;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(s.level);
  const [number, setNumber] = useState(s.number);
  const [title, setTitle] = useState(s.title);
  const [desc, setDesc] = useState(s.description ?? "");
  const [video, setVideo] = useState(s.video_url);
  const [zoom, setZoom] = useState(s.zoom_link);
  const [materialPath, setMaterialPath] = useState(s.material_path);
  const [materialName, setMaterialName] = useState(s.material_name);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [published, setPublished] = useState(s.is_published);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLevel(s.level);
    setNumber(s.number);
    setTitle(s.title);
    setDesc(s.description ?? "");
    setVideo(s.video_url);
    setZoom(s.zoom_link);
    setMaterialPath(s.material_path);
    setMaterialName(s.material_name);
    setFileToUpload(null);
    setPublished(s.is_published);
  }, [s]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error: e1 } = await supabase
        .from("class_sessions")
        .update({ level: Number(level), number: Number(number), title, description: desc || null, is_published: published })
        .eq("id", s.id);
      if (e1) throw e1;

      if (video.trim()) {
        await supabase.from("session_recordings").upsert(
          { session_id: s.id, class_id: classId, video_url: video.trim() },
          { onConflict: "session_id" }
        );
      } else {
        await supabase.from("session_recordings").delete().eq("session_id", s.id);
      }

      let newPath = materialPath;
      let newName = materialName;

      if (fileToUpload) {
        if (fileToUpload.size > FILE_MAX_BYTES) {
          throw new Error("Ukuran PDF maksimal 15MB.");
        }
        const ext = fileExt(fileToUpload.name);
        const path = `materials/${classId}/${s.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("payment_proofs").upload(path, fileToUpload, {
          contentType: fileToUpload.type || "application/pdf",
          upsert: true,
        });
        if (upErr) throw upErr;
        newPath = path;
        newName = fileToUpload.name;
      }

      const sb = supabase as any;
      if (zoom.trim() || newPath) {
        await sb.from("session_private").upsert(
          {
            session_id: s.id,
            class_id: classId,
            zoom_link: zoom.trim() || null,
            material_path: newPath || null,
            material_name: newName || null,
          },
          { onConflict: "session_id" }
        );
      } else {
        await sb.from("session_private").delete().eq("session_id", s.id);
      }

      toast.success("Sesi disimpan.");
      setOpen(false);
      onSaved();
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message ?? "Gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMaterial() {
    if (!materialPath) return;
    if (!confirm("Hapus file PDF dari sesi ini?")) return;
    setBusy(true);
    try {
      await supabase.storage.from("payment_proofs").remove([materialPath]);
      const sb = supabase as any;
      if (zoom.trim()) {
        await sb.from("session_private").update({ material_path: null, material_name: null }).eq("session_id", s.id);
      } else {
        await sb.from("session_private").delete().eq("session_id", s.id);
      }
      setMaterialPath("");
      setMaterialName("");
      toast.success("Materi PDF dihapus.");
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? "Gagal menghapus materi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border p-3 flex items-center justify-between gap-2">
      <div>
        <div className="font-semibold text-sm">
          Level {s.level} · Sesi {s.number}: {s.title}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
          <span className={`px-2 py-0.2 rounded-full text-[10px] ${s.is_published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {s.is_published ? "Terbit" : "Draf"}
          </span>
          {s.video_url && <span>• Ada rekaman</span>}
          {s.zoom_link && <span>• Ada Zoom</span>}
          {s.material_path && <span>• Ada PDF</span>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <SessionGrades sessionId={s.id} classId={classId} label={`Level ${s.level} · Sesi ${s.number}`} />
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Ubah
        </Button>
        <AdminDelete
          table="class_sessions"
          id={s.id}
          label={`Sesi ${s.number} ${s.title}`}
          onDeleted={() => {
            onSaved();
            qc.invalidateQueries();
          }}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ubah Sesi</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Level</Label>
                <Input type="number" value={level} onChange={(e) => setLevel(Number(e.target.value))} required />
              </div>
              <div>
                <Label>Nomor sesi</Label>
                <Input type="number" value={number} onChange={(e) => setNumber(Number(e.target.value))} required />
              </div>
            </div>
            <div>
              <Label>Judul sesi</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label>Deskripsi / Catatan ringkas</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Link Rekaman YouTube</Label>
              <Input value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
            </div>
            <div>
              <Label>Link Pertemuan Zoom (khusus sesi ini)</Label>
              <Input value={zoom} onChange={(e) => setZoom(e.target.value)} placeholder="https://zoom.us/j/..." />
            </div>
            <div className="space-y-1.5 rounded-lg border p-2.5">
              <Label className="text-xs font-semibold">Materi PDF / Tugas</Label>
              {materialPath ? (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => openPrivateFile(materialPath)}
                    className="truncate text-primary underline hover:opacity-80"
                  >
                    {materialName || "Buka file PDF"}
                  </button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={removeMaterial}>
                    Hapus PDF
                  </Button>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">Belum ada file PDF terunggah.</p>
              )}
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFileToUpload(e.target.files?.[0] ?? null)}
              />
              <p className="text-[10px] text-muted-foreground">Format PDF, maksimal 15MB.</p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Switch checked={published} onCheckedChange={setPublished} />
              <Label>Publikasikan (terlihat oleh murid lunas)</Label>
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Menyimpan..." : "Simpan Sesi"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionGrades({ sessionId, classId, label }: { sessionId: string; classId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["admin-grades", sessionId],
    enabled: open,
    queryFn: async () => {
      const sb = supabase as any;
      const { data: enr } = await supabase.from("enrollments").select("user_id").eq("class_id", classId).eq("status", "paid");
      const ids = [...new Set((enr ?? []).map((x) => x.user_id))];
      const { data: p } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
      const [sub, res] = await Promise.all([
        sb.from("session_submissions").select("*").eq("session_id", sessionId),
        sb.from("session_results").select("*").eq("session_id", sessionId),
      ]);
      return ids
        .map((id) => ({
          user_id: id,
          name: p?.find((y) => y.id === id)?.full_name || "(tanpa nama)",
          sub: (sub.data ?? []).find((x: any) => x.user_id === id),
          res: (res.data ?? []).find((x: any) => x.user_id === id),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Tugas &amp; nilai
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tugas &amp; nilai · {label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {data?.length === 0 && <p className="text-muted-foreground">Belum ada murid yang lunas di kelas ini.</p>}
            {data?.map((row) => (
              <GradeRow key={row.user_id} row={row} sessionId={sessionId} classId={classId} onSaved={() => refetch()} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GradeRow({
  row,
  sessionId,
  classId,
  onSaved,
}: {
  row: { user_id: string; name: string; sub?: any; res?: any };
  sessionId: string;
  classId: string;
  onSaved: () => void;
}) {
  const [grade, setGrade] = useState(row.res?.grade != null ? String(row.res.grade) : "");
  const [feedback, setFeedback] = useState<string>(row.res?.feedback ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = grade.trim() === "" ? null : Number(grade);
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 100)) {
      toast.error("Nilai harus antara 0 sampai 100.");
      return;
    }
    setBusy(true);
    const sb = supabase as any;
    const r =
      n === null && !feedback.trim()
        ? await sb.from("session_results").delete().eq("session_id", sessionId).eq("user_id", row.user_id)
        : await sb.from("session_results").upsert({
            session_id: sessionId,
            user_id: row.user_id,
            class_id: classId,
            grade: n,
            feedback: feedback.trim(),
            graded_at: new Date().toISOString(),
          });
    setBusy(false);
    if (r.error) {
      toast.error(r.error.message);
      return;
    }
    toast.success("Nilai disimpan.");
    onSaved();
  }

  return (
    <div className="rounded-xl border p-3 space-y-2">
      <div className="font-semibold text-sm">{row.name}</div>
      {row.sub ? (
        <div className="text-xs text-muted-foreground space-y-1">
          {row.sub.submission_url && (
            <div>
              Tautan:{" "}
              <a href={row.sub.submission_url} target="_blank" rel="noreferrer" className="text-primary underline">
                {row.sub.submission_url}
              </a>
            </div>
          )}
          {row.sub.file_path && (
            <div>
              <button
                type="button"
                onClick={() => openPrivateFile(row.sub.file_path)}
                className="text-primary underline hover:opacity-80"
              >
                Unduh / Buka file tugas
              </button>
            </div>
          )}
          {row.sub.notes && <div>Catatan: {row.sub.notes}</div>}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic">Belum mengumpulkan tugas</div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Input
          type="number"
          placeholder="Nilai (0-100)"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="col-span-1"
        />
        <Input
          placeholder="Catatan / Feedback (Tajwid, makhraj, dll.)"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="col-span-2"
        />
      </div>
      <Button size="sm" onClick={save} disabled={busy}>
        {busy ? "Menyimpan..." : "Simpan nilai"}
      </Button>
    </div>
  );
}

function Peserta() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const { data } = useQuery({
    queryKey: ["admin-peserta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, classes(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((x) => x.user_id))];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("*").in("id", ids) : { data: [] };
      return (data ?? []).map((e) => ({
        ...e,
        profile: profs?.find((p) => p.id === e.user_id),
      }));
    },
  });

  async function updateStatus(id: string, status: "paid" | "rejected") {
    const { error } = await supabase.from("enrollments").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Status diperbarui.");
    qc.invalidateQueries({ queryKey: ["admin-peserta"] });
    qc.invalidateQueries({ queryKey: ["admin-dash-enr"] });
  }

  const rows = (data ?? []).filter((x) => (filter === "all" ? true : x.status === filter));

  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2">
        {(["all", "pending", "paid", "rejected"] as const).map((k) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
            {k === "all" ? "Semua" : k === "pending" ? "Menunggu" : k === "paid" ? "Lunas" : "Ditolak"}
          </Button>
        ))}
      </div>
      <div className="divide-y rounded-2xl border">
        {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">Belum ada pendaftar.</p>}
        {rows.map((e) => (
          <div key={e.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{e.profile?.full_name ?? "(tanpa nama)"}</div>
                <div className="text-xs text-muted-foreground">{e.profile?.phone ?? "-"}</div>
                <div className="text-xs text-muted-foreground">
                  Kelas: {e.classes?.title ?? "-"} · {tanggal(e.created_at)}
                </div>
                <div className="text-xs font-medium text-primary mt-1">
                  Paket: {e.package_type === "session" ? `Per Sesi (${e.session_count ?? 8} sesi)` : "Bulanan"}
                </div>
              </div>
              <div className="text-right">
                <StatusBadge status={e.status} />
                <div className="mt-1 font-bold">{rupiah(e.amount_paid)}</div>
              </div>
            </div>

            <PaymentProof
              enrollmentId={e.id}
              proofPath={e.payment_proof_path}
              isAdmin={true}
              onProofRemoved={() => qc.invalidateQueries({ queryKey: ["admin-peserta"] })}
            />

            <ProgressEditor
              profileId={e.user_id}
              currentLevel={e.profile?.current_level ?? 1}
              notes={e.profile?.test_notes ?? ""}
              onSaved={() => qc.invalidateQueries({ queryKey: ["admin-peserta"] })}
            />

            {e.status === "pending" && (
              <div className="flex gap-2 pt-2 border-t">
                <Button size="sm" onClick={() => updateStatus(e.id, "paid")}>
                  Konfirmasi Lunas
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus(e.id, "rejected")}>
                  Tolak
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressEditor({
  profileId,
  currentLevel,
  notes,
  onSaved,
}: {
  profileId: string;
  currentLevel: number;
  notes: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(currentLevel);
  const [text, setText] = useState(notes);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ current_level: level, test_notes: text }).eq("id", profileId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Progres diperbarui.");
    setOpen(false);
    onSaved();
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="text-xs">
        Level {currentLevel} · Edit progres
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catatan Progres Santri</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Level saat ini</Label>
              <Select value={String(level)} onValueChange={(v) => setLevel(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Level 1 — {classLevelName(1)}</SelectItem>
                  <SelectItem value="2">Level 2 — {classLevelName(2)}</SelectItem>
                  <SelectItem value="3">Level 3 — {classLevelName(3)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Catatan bacaan / evaluasi</Label>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
            </div>
            <Button onClick={save} disabled={busy} className="w-full">
              {busy ? "Menyimpan..." : "Simpan Progres"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function KelolaIlmu() {
  const qc = useQueryClient();
  const { data } = useSubjects();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<"subjects"> | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [desc, setDesc] = useState("");
  const [icon, setIcon] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  function startAdd() {
    setEditing(null);
    setName("");
    setSlug("");
    setDesc("");
    setIcon("book");
    setActive(true);
    setOpen(true);
  }

  function startEdit(s: Tables<"subjects">) {
    setEditing(s);
    setName(s.name);
    setSlug(s.slug);
    setDesc(s.description ?? "");
    setIcon(s.icon_name ?? "book");
    setActive(s.is_active);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      name,
      slug,
      description: desc || null,
      icon_name: icon || null,
      is_active: active,
    };
    try {
      if (editing) {
        const { error } = await supabase.from("subjects").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subjects").insert(payload);
        if (error) throw error;
      }
      toast.success("Ilmu disimpan.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-subjects"] });
    } catch (err: any) {
      toast.error(err.message ?? "Gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <Button onClick={startAdd}>+ Tambah ilmu</Button>
      <div className="divide-y rounded-2xl border">
        {data?.map((s) => (
          <div key={s.id} className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">{s.name}</div>
              <div className="text-xs text-muted-foreground">
                slug: /{s.slug} · {s.is_active ? "Aktif" : "Nonaktif"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => startEdit(s)}>
                Ubah
              </Button>
              <AdminDelete
                table="subjects"
                id={s.id}
                label={s.name}
                guardMessage="Ilmu yang masih memiliki kelas tidak dapat dihapus."
                onDeleted={() => qc.invalidateQueries({ queryKey: ["admin-subjects"] })}
              />
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Ilmu" : "Tambah Ilmu"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div>
              <Label>Nama ilmu</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>Slug URL</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} required />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label>Tampilkan di katalog publik</Label>
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Menyimpan..." : "Simpan"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KelolaVoucher() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState(10);
  const [maxUsage, setMaxUsage] = useState<number | undefined>(undefined);
  const [expiresAt, setExpiresAt] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-vouchers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vouchers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("vouchers").insert({
      code: code.trim().toUpperCase(),
      discount_type: discountType,
      discount_value: Number(discountValue),
      max_usage: maxUsage ? Number(maxUsage) : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      is_active: active,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Voucher dibuat.");
    setOpen(false);
    setCode("");
    qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
  }

  async function toggle(id: string, current: boolean) {
    const { error } = await supabase.from("vouchers").update({ is_active: !current }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
  }

  async function remove(id: string) {
    if (!confirm("Hapus voucher ini?")) return;
    const { error } = await supabase.from("vouchers").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
  }

  return (
    <div className="mt-4 space-y-3">
      <Button onClick={() => setOpen(true)}>+ Buat voucher</Button>
      <div className="divide-y rounded-2xl border">
        {data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">Belum ada voucher.</p>}
        {data?.map((v) => (
          <div key={v.id} className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold tracking-wide font-mono text-primary">{v.code}</div>
              <div className="text-xs text-muted-foreground">
                Diskon: {v.discount_type === "percentage" ? `${v.discount_value}%` : rupiah(v.discount_value)} · Terpakai: {v.used_count}x
                {v.max_usage ? ` / maks ${v.max_usage}x` : ""} · {v.is_active ? "Aktif" : "Nonaktif"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => toggle(v.id, v.is_active)}>
                {v.is_active ? "Nonaktifkan" : "Aktifkan"}
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(v.id)}>
                Hapus
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Voucher Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={add} className="space-y-3">
            <div>
              <Label>Kode Voucher</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CONTOH: NGAJIHEMAT"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipe Diskon</Label>
                <Select value={discountType} onValueChange={(val: any) => setDiscountType(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Persen (%)</SelectItem>
                    <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nilai Diskon</Label>
                <Input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Batas Penggunaan (opsional)</Label>
              <Input
                type="number"
                placeholder="Kosongkan jika tak terbatas"
                value={maxUsage ?? ""}
                onChange={(e) => setMaxUsage(e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
            <div>
              <Label>Kedaluwarsa (opsional)</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label>Aktifkan langsung</Label>
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Menyimpan..." : "Buat Voucher"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Pengaturan() {
  const qc = useQueryClient();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*");
      const map: Record<string, string> = {};
      for (const row of data ?? []) map[row.key] = row.value;
      return map;
    },
  });

  useEffect(() => {
    if (data) setVals(data);
  }, [data]);

  async function saveSettings() {
    setBusy(true);
    try {
      for (const [key, value] of Object.entries(vals)) {
        await supabase.from("settings").upsert({ key, value });
      }
      toast.success("Pengaturan disimpan.");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
    } catch (err: any) {
      toast.error(err.message ?? "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error("Ukuran logo maksimal 1MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setVals((prev) => ({ ...prev, logo_url: b64 }));
    };
    reader.readAsDataURL(file);
  }

  function handleQrisUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran QRIS maksimal 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setVals((prev) => ({ ...prev, qris_image_url: b64 }));
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="mt-4 space-y-4 max-w-lg">
      <div>
        <Label>Nama Platform</Label>
        <Input
          value={vals.site_name ?? ""}
          onChange={(e) => setVals({ ...vals, site_name: e.target.value })}
          placeholder="PadatIlmu"
        />
      </div>

      <div className="space-y-2 rounded-xl border p-3">
        <Label>Logo Header</Label>
        {vals.logo_url && (
          <div className="flex items-center gap-3">
            <img src={vals.logo_url} alt="Logo" className="h-10 w-auto rounded border bg-white p-1" />
            <Button size="sm" variant="outline" onClick={() => setVals({ ...vals, logo_url: "" })}>
              Hapus Logo
            </Button>
          </div>
        )}
        <Input type="file" accept="image/*" onChange={handleLogoUpload} />
      </div>

      <div>
        <Label>Nomor WhatsApp Admin (diawali 62)</Label>
        <Input
          value={vals.admin_whatsapp ?? ""}
          onChange={(e) => setVals({ ...vals, admin_whatsapp: e.target.value })}
          placeholder="6281234567890"
        />
      </div>

      <div>
        <Label>Nama Bank</Label>
        <Input
          value={vals.bank_name ?? ""}
          onChange={(e) => setVals({ ...vals, bank_name: e.target.value })}
          placeholder="BCA / Mandiri / BSI"
        />
      </div>

      <div>
        <Label>Nomor Rekening</Label>
        <Input
          value={vals.bank_account_number ?? ""}
          onChange={(e) => setVals({ ...vals, bank_account_number: e.target.value })}
        />
      </div>

      <div>
        <Label>Atas Nama Rekening</Label>
        <Input
          value={vals.bank_account_holder ?? ""}
          onChange={(e) => setVals({ ...vals, bank_account_holder: e.target.value })}
        />
      </div>

      <div className="space-y-2 rounded-xl border p-3">
        <Label>Foto / Gambar QRIS</Label>
        {vals.qris_image_url && (
          <div className="space-y-2">
            <img src={vals.qris_image_url} alt="QRIS" className="max-h-48 rounded border object-contain" />
            <Button size="sm" variant="outline" onClick={() => setVals({ ...vals, qris_image_url: "" })}>
              Hapus QRIS
            </Button>
          </div>
        )}
        <Input type="file" accept="image/*" onChange={handleQrisUpload} />
      </div>

      <Button onClick={saveSettings} disabled={busy} className="w-full">
        {busy ? "Menyimpan..." : "Simpan Pengaturan"}
      </Button>
    </div>
  );
}
