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

function slugify(text: string, fallback: string) {
  const s = (text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || fallback;
}

/** Simpan baris baru; kalau slug sudah dipakai, otomatis ditambah kode pendek. */
async function insertWithUniqueSlug(table: "classes" | "subjects", payload: any) {
  let res: any = await supabase.from(table).insert(payload).select().single();
  if (res.error && res.error.code === "23505") {
    res = await supabase.from(table).insert({ ...payload, slug: `${payload.slug}-${Math.random().toString(36).slice(2, 6)}` }).select().single();
  }
  return res;
}

function useClasses() {
  return useQuery({
    queryKey: ["admin-classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*, class_private(*)").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useSubjects() {
  return useQuery({
    queryKey: ["admin-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function SubjectPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useSubjects();
  return (
    <div className="space-y-1">
      <Label>Ilmu</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label="Ilmu">
          <SelectValue placeholder="Pilih ilmu" />
        </SelectTrigger>
        <SelectContent>
          {data?.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
              {!s.is_active && " (nonaktif)"}
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
                    {c.name}
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
                      Pengampu: {assignedClass ? assignedClass.name : "Semua Kelas"}
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
      const { data, error } = await (supabase as any).from("announcements").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InfoRow[];
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    qc.invalidateQueries({ queryKey: ["notif-announcements"] });
  }

  async function kirim() {
    if (!title.trim()) {
      toast.error("Judul info wajib diisi.");
      return;
    }
    setBusy(true);
    const { error } = await (supabase as any).from("announcements").insert({ title: title.trim(), body: body.trim() });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Info terkirim ke semua murid.");
    setTitle("");
    setBody("");
    refresh();
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <p className="font-semibold">Kirim info ke semua murid</p>
        <div className="space-y-1">
          <Label>Judul</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Kelas Jumat diundur" />
        </div>
        <div className="space-y-1">
          <Label>Isi info (opsional)</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <Button className="w-full" disabled={busy} onClick={kirim}>
          {busy ? "Mengirim..." : "Kirim info"}
        </Button>
      </div>
      {data?.length === 0 && <p className="text-muted-foreground">Belum ada info.</p>}
      {data?.map((a) => (
        <div key={a.id} className="space-y-2 rounded-2xl border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{a.title}</p>
              <p className="text-xs text-muted-foreground">{tanggal(a.created_at)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Switch
                checked={a.is_active}
                aria-label="Tampilkan ke murid"
                onCheckedChange={async (v) => {
                  const { error } = await (supabase as any).from("announcements").update({ is_active: v }).eq("id", a.id);
                  if (error) toast.error(error.message);
                  else refresh();
                }}
              />
              <AdminDelete
                name="info"
                description="Info ini hilang dari notifikasi semua murid."
                onDelete={async () => {
                  const { error } = await (supabase as any).from("announcements").delete().eq("id", a.id);
                  if (error) throw new Error(error.message);
                  refresh();
                }}
              />
            </div>
          </div>
          {a.body && <p className="whitespace-pre-line break-words text-sm text-muted-foreground">{a.body}</p>}
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["admin-dash"],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments").select("user_id, amount, status, paid_at");
      const rows = data ?? [];
      const paid = rows.filter((r) => r.status === "paid");
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return {
        murid: new Set(paid.map((r) => r.user_id)).size,
        pemasukan: paid.filter((r) => r.paid_at && new Date(r.paid_at) >= start).reduce((s, r) => s + r.amount, 0),
        pending: rows.filter((r) => r.status === "pending").length,
      };
    },
  });
  const cards = [
    { label: "Murid aktif (lunas)", value: data?.murid ?? "-" },
    { label: "Pemasukan bulan ini", value: data ? rupiah(data.pemasukan) : "-" },
    { label: "Menunggu konfirmasi", value: data?.pending ?? "-" },
  ];
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">{c.label}</p>
          <p className="mt-1 font-display text-3xl font-semibold text-primary">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

type ClassForm = Partial<Tables<"classes">> & {
  whatsapp_link?: string;
  zoom_link?: string;
  package_type?: string;
  package_weeks?: number;
  package_sessions?: number;
};

function KelolaKelas() {
  const { data } = useClasses();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<ClassForm | null>(null);

  async function save() {
    if (!edit) return;
    if (!edit.name?.trim() || !edit.subject_id) {
      toast.error("Nama kelas dan ilmu wajib diisi.");
      return;
    }
    const { whatsapp_link = "", zoom_link = "", ...rest } = edit;
    const payload: any = {
      slug: rest.slug || slugify(rest.name ?? "", "kelas"),
      name: rest.name ?? "",
      tagline: rest.tagline ?? "",
      description: rest.description ?? "",
      goals: rest.goals ?? "",
      levels_label: rest.levels_label ?? "Level 1–2",
      schedule: rest.schedule ?? "",
      quota: Number(rest.quota ?? 10),
      price: Number(rest.price ?? 0),
      price_prefix: rest.price_prefix ?? "",
      is_active: rest.is_active ?? true,
      package_type: rest.package_type === "session" ? "session" : "monthly",
      package_weeks: rest.package_type === "session" ? 4 : Number(rest.package_weeks || 4),
      package_sessions: rest.package_type === "session" ? Number(rest.package_sessions || 1) : 0,
      sort_order: rest.sort_order ?? 99,
      subject_id: edit.subject_id,
      level_number: Number(rest.level_number ?? 1),
      level_label: rest.level_label ?? "Baru Belajar",
      advantages: rest.advantages ?? "",
    };
    const res = rest.id
      ? await supabase.from("classes").update(payload).eq("id", rest.id).select().single()
      : await insertWithUniqueSlug("classes", payload);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    const { error } = await supabase.from("class_private").upsert({ class_id: res.data.id, whatsapp_link, zoom_link });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Kelas disimpan.");
    setEdit(null);
    qc.invalidateQueries();
  }

  const f = (k: keyof ClassForm, label: string, type: "text" | "number" | "area" = "text") => (
    <div className="space-y-1">
      <Label>{label}</Label>
      {type === "area" ? (
        <Textarea value={String(edit?.[k] ?? "")} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />
      ) : (
        <Input type={type} value={String(edit?.[k] ?? "")} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />
      )}
    </div>
  );

  return (
    <div className="mt-4 space-y-3">
      <Button onClick={() => setEdit({ is_active: true, level_number: 1, level_label: "Baru Belajar", package_type: "monthly", package_weeks: 4, package_sessions: 0 })}>
        + Tambah kelas
      </Button>
      {data?.map((c) => {
        return (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
            <div>
              <p className="font-semibold">
                {classLevelName(c)} {!c.is_active && <span className="text-xs text-muted-foreground">(nonaktif)</span>}
              </p>
              <p className="text-sm text-muted-foreground">
                {c.price_prefix} {rupiah(c.price)} / {packageUnit(c)}
                {" · kuota "}
                {c.quota}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setEdit({
                    ...c,
                    whatsapp_link: c.class_private?.whatsapp_link ?? "",
                    zoom_link: c.class_private?.zoom_link ?? "",
                  })
                }
              >
                Ubah
              </Button>
              <AdminDelete
                name={classLevelName(c)}
                description="Sesi dan rekaman kelas ini ikut dihapus. Kelas yang memiliki pendaftar tidak dapat dihapus; nonaktifkan kelas untuk menyimpan riwayat pembayaran."
                onDelete={async () => {
                  const { error } = await supabase.from("classes").delete().eq("id", c.id);
                  if (error) throw new Error(error.message);
                  await qc.invalidateQueries();
                }}
              />
            </div>
          </div>
        );
      })}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Ubah kelas" : "Kelas baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <SubjectPicker
              value={edit?.subject_id ?? ""}
              onChange={(v) => setEdit((current) => (current ? { ...current, subject_id: v } : null))}
            />
            {f("name", "Nama kelas")}
            {f("tagline", "Tagline")}
            {f("description", "Deskripsi", "area")}
            {f("goals", "Tujuan", "area")}
            {f("advantages", "Keunggulan", "area")}
            {f("level_number", "Nomor level", "number")}
            {f("level_label", "Nama level")}
            {f("levels_label", "Level")}
            {f("schedule", "Jadwal")}
            {f("quota", "Kuota", "number")}
            {f("price_prefix", "Awalan harga (mis. Mulai)")}
            {f("price", "Harga paket (Rp)", "number")}
            <div className="space-y-1">
              <Label>Jenis paket</Label>
              <Select
                value={edit?.package_type === "session" ? "session" : "monthly"}
                onValueChange={(v) => setEdit({ ...edit, package_type: v })}
              >
                <SelectTrigger aria-label="Jenis paket">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Bulanan</SelectItem>
                  <SelectItem value="session">Per sesi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {edit?.package_type === "session" ? (
              <div className="space-y-1">
                <Label>Jumlah sesi</Label>
                <Select
                  value={String(edit?.package_sessions || 1)}
                  onValueChange={(v) => setEdit({ ...edit, package_sessions: Number(v) })}
                >
                  <SelectTrigger aria-label="Jumlah sesi">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} sesi
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Durasi</Label>
                <Select
                  value={String(edit?.package_weeks || 4)}
                  onValueChange={(v) => setEdit({ ...edit, package_weeks: Number(v) })}
                >
                  <SelectTrigger aria-label="Durasi">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 minggu</SelectItem>
                    <SelectItem value="2">2 minggu</SelectItem>
                    <SelectItem value="3">3 minggu</SelectItem>
                    <SelectItem value="4">1 bulan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {f("whatsapp_link", "Link grup WhatsApp")}
            {f("zoom_link", "Link Zoom")}
            <div className="flex items-center gap-2">
              <Switch checked={edit?.is_active ?? true} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />
              <Label>Tampilkan ke publik</Label>
            </div>
            <Button className="w-full" onClick={save}>
              Simpan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClassPicker({ value, onChange, subjectId }: { value: string; onChange: (v: string) => void; subjectId?: string }) {
  const { data } = useClasses();
  const choices = subjectId === undefined ? data ?? [] : classesInSubject(data ?? [], subjectId);
  useEffect(() => {
    if (value && !choices.some((c) => c.id === value)) onChange("");
  }, [choices, value, onChange]);
  return (
    <div className="space-y-1">
      <Label>Kelas</Label>
      <Select value={value} onValueChange={onChange} disabled={subjectId === "" || choices.length === 0}>
        <SelectTrigger aria-label="Kelas">
          <SelectValue placeholder={choices.length ? "Pilih kelas" : "Belum ada kelas"} />
        </SelectTrigger>
        <SelectContent>
          {choices.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {classLevelName(c)}
              {!c.is_active && " (nonaktif)"}
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
  s: Tables<"class_sessions"> & { video_url: string; zoom_link: string; material_path: string; material_name: string };
  classId: string;
  onSaved: () => Promise<void>;
}) {
  const [v, setV] = useState(s);
  const [busyFile, setBusyFile] = useState(false);
  const qc = useQueryClient();

  async function uploadMaterial(file: File) {
    if (fileExt(file.name) !== "pdf") {
      toast.error("Materi harus berupa file PDF.");
      return;
    }
    if (file.size === 0 || file.size > FILE_MAX_BYTES) {
      toast.error("Ukuran PDF maksimal 20 MB.");
      return;
    }
    setBusyFile(true);
    const path = `${classId}/${s.id}/${crypto.randomUUID()}.pdf`;
    const up = await supabase.storage.from("session-materials").upload(path, file, { contentType: "application/pdf" });
    if (up.error) {
      toast.error(up.error.message);
      setBusyFile(false);
      return;
    }
    const r = await (supabase as any)
      .from("session_private")
      .upsert({ session_id: s.id, class_id: classId, material_path: path, material_name: file.name.slice(0, 200) });
    if (r.error) {
      await supabase.storage.from("session-materials").remove([path]);
      toast.error(r.error.message);
      setBusyFile(false);
      return;
    }
    if (v.material_path) await supabase.storage.from("session-materials").remove([v.material_path]);
    setV((cur) => ({ ...cur, material_path: path, material_name: file.name }));
    toast.success("Materi PDF tersimpan.");
    setBusyFile(false);
    qc.invalidateQueries();
  }

  async function removeMaterial() {
    if (!v.material_path) return;
    setBusyFile(true);
    const r = await (supabase as any)
      .from("session_private")
      .upsert({ session_id: s.id, class_id: classId, material_path: "", material_name: "" });
    if (r.error) {
      toast.error(r.error.message);
      setBusyFile(false);
      return;
    }
    await supabase.storage.from("session-materials").remove([v.material_path]);
    setV((cur) => ({ ...cur, material_path: "", material_name: "" }));
    toast.success("Materi PDF dihapus.");
    setBusyFile(false);
    qc.invalidateQueries();
  }

  async function save() {
    const { error } = await supabase
      .from("class_sessions")
      .update({
        title: v.title,
        description: v.description,
        scheduled_at: v.scheduled_at,
        level: Number(v.level),
        number: Number(v.number),
      })
      .eq("id", s.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const r = v.video_url.trim()
      ? await supabase.from("session_recordings").upsert({ session_id: s.id, class_id: classId, video_url: v.video_url.trim() })
      : await supabase.from("session_recordings").delete().eq("session_id", s.id);
    if (r.error) {
      toast.error(r.error.message);
      return;
    }
    if ((v.zoom_link ?? "").trim() !== (s.zoom_link ?? "")) {
      const z = await (supabase as any)
        .from("session_private")
        .upsert({ session_id: s.id, class_id: classId, zoom_link: (v.zoom_link ?? "").trim() });
      if (z.error) {
        toast.error(z.error.message);
        return;
      }
    }
    const published = await supabase.from("class_sessions").update({ is_published: v.is_published }).eq("id", s.id);
    if (published.error) {
      toast.error(published.error.message);
      return;
    }
    toast.success(v.is_published ? `Sesi ${v.number} diterbitkan.` : `Sesi ${v.number} disimpan sebagai draf.`);
    await onSaved();
    qc.invalidateQueries();
  }
  return (
    <details className="rounded-2xl border bg-card p-4">
      <summary className="cursor-pointer font-medium">
        L{s.level} · Sesi {s.number}: {s.title} · {s.is_published ? "Terbit" : "Draf"} {s.video_url && "🎬"}
      </summary>
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Level</Label>
            <Input type="number" value={v.level} onChange={(e) => setV({ ...v, level: Number(e.target.value) })} />
          </div>
          <div>
            <Label>No. sesi</Label>
            <Input type="number" value={v.number} onChange={(e) => setV({ ...v, number: Number(e.target.value) })} />
          </div>
        </div>
        <Label>Judul</Label>
        <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        <Label>Deskripsi</Label>
        <Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        <Label>Jadwal (mis. Sabtu, 12 Okt 08.00 WIB)</Label>
        <Input value={v.scheduled_at} onChange={(e) => setV({ ...v, scheduled_at: e.target.value })} />
        <Label>Link rekaman (YouTube / Vimeo / Google Drive / Dailymotion)</Label>
        <Input
          value={v.video_url}
          onChange={(e) => setV({ ...v, video_url: e.target.value })}
          placeholder="https://youtu.be/..."
        />
        <Label>Link Zoom sesi ini (beda tiap pertemuan)</Label>
        <Input
          value={v.zoom_link ?? ""}
          onChange={(e) => setV({ ...v, zoom_link: e.target.value })}
          placeholder="https://zoom.us/j/..."
        />
        <Label>Materi PDF sesi ini</Label>
        {v.material_path ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="break-all">{v.material_name || "materi.pdf"}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openPrivateFile("session-materials", v.material_path).catch((e) => toast.error(e.message))}
            >
              Buka
            </Button>
            <Button size="sm" variant="outline" disabled={busyFile} onClick={removeMaterial}>
              Hapus
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada PDF.</p>
        )}
        <Input
          type="file"
          accept="application/pdf,.pdf"
          disabled={busyFile}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) uploadMaterial(f);
          }}
        />
        <div className="flex items-center gap-2">
          <Switch
            id={`publish-${s.id}`}
            checked={v.is_published}
            onCheckedChange={(is_published) => setV({ ...v, is_published })}
          />
          <Label htmlFor={`publish-${s.id}`}>Terbitkan untuk murid</Label>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={save}>
            {v.is_published ? "Simpan dan terbitkan" : "Simpan draf"}
          </Button>
          <SessionGrades sessionId={s.id} classId={classId} label={`Sesi ${s.number}: ${s.title}`} />
          <AdminDelete
            name={`sesi ${s.number}`}
            description="Sesi dan link rekamannya akan dihapus permanen."
            onDelete={async () => {
              const { error } = await supabase.from("class_sessions").delete().eq("id", s.id);
              if (error) throw new Error(error.message);
              await onSaved();
              await qc.invalidateQueries();
            }}
          />
        </div>
      </div>
    </details>
  );
}

function SessionGrades({ sessionId, classId, label }: { sessionId: string; classId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["admin-grades", sessionId],
    enabled: open,
    queryFn: async () => {
      const sb = supabase as any;
      // Daftar murid lunas lewat fungsi khusus: nama saja, tanpa data pembayaran (aman untuk pengajar).
      const { data: students, error: stErr } = await sb.rpc("class_paid_students", { _class_id: classId });
      if (stErr) throw stErr;
      const [sub, res] = await Promise.all([
        sb.from("session_submissions").select("*").eq("session_id", sessionId),
        sb.from("session_results").select("*").eq("session_id", sessionId),
      ]);
      return ((students ?? []) as { user_id: string; full_name: string }[])
        .map((st) => ({
          user_id: st.user_id,
          name: st.full_name || "(tanpa nama)",
          sub: (sub.data ?? []).find((x: any) => x.user_id === st.user_id),
          res: (res.data ?? []).find((x: any) => x.user_id === st.user_id),
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
    <div className="space-y-2 rounded-2xl border bg-card p-3">
      <p className="font-semibold">{row.name}</p>
      {row.sub ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="break-all">Tugas: {row.sub.file_name}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openPrivateFile("assignments", row.sub.file_path).catch((e) => toast.error(e.message))}
          >
            Buka tugas
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Belum mengirim tugas.</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label>Nilai (0-100)</Label>
          <Input type="number" min={0} max={100} value={grade} onChange={(e) => setGrade(e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Catatan</Label>
          <Input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Opsional" />
        </div>
      </div>
      <Button size="sm" disabled={busy} onClick={save}>
        {busy ? "Menyimpan..." : "Simpan nilai"}
      </Button>
    </div>
  );
}

function Peserta() {
  const [classId, setClassId] = useState("");
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-peserta", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data: e } = await supabase.from("enrollments").select("*").eq("class_id", classId).order("created_at", { ascending: false });
      const ids = [...new Set((e ?? []).map((x) => x.user_id))];
      const { data: p } = ids.length ? await supabase.from("profiles").select("*").in("id", ids) : { data: [] };
      return (e ?? []).map((x) => ({ ...x, profile: p?.find((y) => y.id === x.user_id) }));
    },
  });

  async function setStatus(id: string, status: "paid" | "rejected") {
    const { error } = await supabase.from("enrollments").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "paid" ? "Pembayaran dikonfirmasi." : "Pembayaran ditolak.");
    qc.invalidateQueries();
  }
  async function setLevel(userId: string, level: number, notes: string) {
    const { error } = await supabase.from("profiles").update({ current_level: level || null, test_notes: notes }).eq("id", userId);
    error ? toast.error(error.message) : toast.success("Progres disimpan.");
  }

  return (
    <div className="mt-4 space-y-3">
      <ClassPicker value={classId} onChange={setClassId} />
      <p className="text-sm text-muted-foreground">{data?.filter((x) => x.status === "paid").length ?? 0} peserta lunas</p>
      {data?.length === 0 && <p className="text-muted-foreground">Belum ada pendaftar.</p>}
      {data?.map((x) => {
        const extraEnr = x as typeof x & { package_type?: string; sessions_total?: number; package_weeks?: number };
        return (
          <div key={x.id} className="space-y-2 rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{x.profile?.full_name || "(tanpa nama)"}</p>
                <p className="text-sm text-muted-foreground">
                  {x.profile?.phone || "-"} · {tanggal(x.created_at)}
                </p>
                <p className="text-sm">
                  {rupiah(x.amount)} · {x.method}
                  {x.sender_name ? ` · a.n. ${x.sender_name}` : ""}
                </p>
                <p className="text-xs font-semibold text-primary">
                  Paket: {extraEnr.package_type === "session" ? `Per Sesi (${extraEnr.sessions_total || 0} Sesi)` : `Bulanan (${(extraEnr.package_weeks || 4) >= 4 ? "1 bulan" : `${extraEnr.package_weeks} minggu`})`}
                </p>
              </div>
              <StatusBadge status={x.status} />
            </div>
            {x.voucher_code && <p className="text-sm text-muted-foreground">Voucher: {x.voucher_code}</p>}
            {x.referral_code && (
              <p className="break-all text-sm text-muted-foreground">
                Referral: {x.referral_code} · Bonus pengajak: {rupiah(x.referral_reward_amount)}
              </p>
            )}
            {x.proof_url ? (
              <PaymentProof path={x.proof_url} enrollmentId={x.id} admin />
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada bukti pembayaran.</p>
            )}
            {x.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" variant="success" onClick={() => setStatus(x.id, "paid")}>
                  Konfirmasi lunas
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(x.id, "rejected")}>
                  Tolak
                </Button>
              </div>
            )}
            {x.status === "paid" && x.profile && <ProgressEditor p={x.profile} onSave={setLevel} />}
          </div>
        );
      })}
    </div>
  );
}

function ProgressEditor({ p, onSave }: { p: Tables<"profiles">; onSave: (id: string, l: number, n: string) => void }) {
  const [level, setLevel] = useState(p.current_level ?? 0);
  const [notes, setNotes] = useState(p.test_notes ?? "");
  return (
    <div className="flex flex-wrap items-end gap-2 border-t pt-2">
      <div className="w-20">
        <Label className="text-xs">Level</Label>
        <Input type="number" value={level} onChange={(e) => setLevel(Number(e.target.value))} />
      </div>
      <div className="flex-1">
        <Label className="text-xs">Hasil tes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button size="sm" variant="secondary" onClick={() => onSave(p.id, level, notes)}>
        Simpan
      </Button>
    </div>
  );
}

type SubjectForm = Partial<Tables<"subjects">>;

function KelolaIlmu() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<SubjectForm | null>(null);
  const { data } = useSubjects();

  async function save() {
    if (!edit) return;
    const payload = {
      slug: edit.slug || slugify(edit.name ?? "", "ilmu"),
      name: edit.name ?? "",
      bio: edit.bio ?? "",
      sort_order: edit.sort_order ?? 99,
      is_active: edit.is_active ?? true,
    };
    const res: any = edit.id
      ? await supabase.from("subjects").update(payload).eq("id", edit.id)
      : await insertWithUniqueSlug("subjects", payload);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Ilmu disimpan.");
    setEdit(null);
    qc.invalidateQueries();
  }

  return (
    <div className="mt-4 space-y-3">
      <Button onClick={() => setEdit({ is_active: true })}>+ Tambah ilmu</Button>
      {data?.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div>
            <p className="font-semibold">
              {s.name} {!s.is_active && <span className="text-xs text-muted-foreground">(nonaktif)</span>}
            </p>
            <p className="line-clamp-2 text-sm text-muted-foreground">{s.bio}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEdit(s)}>
              Ubah
            </Button>
            <AdminDelete
              name={s.name}
              description="Ilmu akan dihapus permanen. Pindahkan atau hapus kelas di dalamnya terlebih dahulu."
              onDelete={async () => {
                const { error } = await supabase.from("subjects").delete().eq("id", s.id);
                if (error) throw new Error(error.message);
                await qc.invalidateQueries();
              }}
            />
          </div>
        </div>
      ))}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Ubah ilmu" : "Ilmu baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nama ilmu</Label>
              <Input value={edit?.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Deskripsi / bio</Label>
              <Textarea value={edit?.bio ?? ""} onChange={(e) => setEdit({ ...edit, bio: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Urutan tampil</Label>
              <Input
                type="number"
                value={edit?.sort_order ?? 0}
                onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={edit?.is_active ?? true} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />
              <Label>Tampilkan ke publik</Label>
            </div>
            <Button className="w-full" onClick={save}>
              Simpan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type VoucherForm = Partial<Tables<"vouchers">>;

function KelolaVoucher() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<VoucherForm | null>(null);
  const { data } = useQuery({
    queryKey: ["admin-vouchers"],
    queryFn: async () => {
      const { data } = await supabase.from("vouchers").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function save() {
    if (!edit) return;
    if (!edit.code?.trim()) {
      toast.error("Kode voucher wajib diisi.");
      return;
    }
    const payload = {
      code: edit.code.trim().toUpperCase(),
      discount_type: edit.discount_type ?? "percent",
      discount_value: Number(edit.discount_value ?? 0),
      max_uses: edit.max_uses ? Number(edit.max_uses) : null,
      is_active: edit.is_active ?? true,
      expires_at: edit.expires_at || null,
    };
    const res = edit.id
      ? await supabase.from("vouchers").update(payload).eq("id", edit.id)
      : await supabase.from("vouchers").insert(payload);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Voucher disimpan.");
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
  }

  return (
    <div className="mt-4 space-y-3">
      <Button onClick={() => setEdit({ is_active: true, discount_type: "percent", discount_value: 10 })}>
        + Tambah voucher
      </Button>
      {data?.length === 0 && <p className="text-muted-foreground">Belum ada voucher.</p>}
      {data?.map((v) => (
        <div key={v.id} className="flex items-center justify-between rounded-2xl border bg-card p-4">
          <div>
            <p className="font-semibold">
              {v.code} {!v.is_active && <span className="text-xs text-muted-foreground">(nonaktif)</span>}
            </p>
            <p className="text-sm text-muted-foreground">
              Diskon {v.discount_type === "percent" ? `${v.discount_value}%` : rupiah(v.discount_value)}
              {" · "}terpakai {v.used_count}
              {v.max_uses ? `/${v.max_uses}` : ""}
              {v.expires_at ? ` · s.d. ${tanggal(v.expires_at)}` : ""}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEdit({ ...v, expires_at: v.expires_at ? v.expires_at.slice(0, 10) : "" })}
          >
            Ubah
          </Button>
        </div>
      ))}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Ubah voucher" : "Voucher baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Kode voucher</Label>
              <Input
                value={edit?.code ?? ""}
                onChange={(e) => setEdit({ ...edit, code: e.target.value })}
                placeholder="Contoh: AJAKTEMAN"
              />
            </div>
            <div className="space-y-1">
              <Label>Jenis diskon</Label>
              <select
                value={edit?.discount_type ?? "percent"}
                onChange={(e) => setEdit({ ...edit, discount_type: e.target.value })}
                className="h-11 w-full rounded-xl border bg-card px-3"
              >
                <option value="percent">Persen (%)</option>
                <option value="fixed">Potongan harga (Rp)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Nilai diskon {edit?.discount_type === "fixed" ? "(Rp)" : "(%)"}</Label>
              <Input
                type="number"
                value={edit?.discount_value ?? 0}
                onChange={(e) => setEdit({ ...edit, discount_value: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label>Batas pemakaian (kosongkan = tanpa batas)</Label>
              <Input
                type="number"
                value={edit?.max_uses ?? ""}
                onChange={(e) => setEdit({ ...edit, max_uses: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
            <div className="space-y-1">
              <Label>Berlaku sampai (kosongkan = selamanya)</Label>
              <Input
                type="date"
                value={edit?.expires_at ?? ""}
                onChange={(e) => setEdit({ ...edit, expires_at: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={edit?.is_active ?? true} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />
              <Label>Aktif</Label>
            </div>
            <Button className="w-full" onClick={save}>
              Simpan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const SETTING_FIELDS = [
  { key: "site_name", label: "Nama Website / Brand (mis. PadatIlmu)" },
  { key: "admin_whatsapp", label: "Nomor WhatsApp admin (mis. 62881022392900)" },
  { key: "bank_name", label: "Nama bank (mis. BCA)" },
  { key: "bank_number", label: "Nomor rekening" },
  { key: "bank_holder", label: "Atas nama rekening" },
] as const;

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
    for (const f of SETTING_FIELDS) {
      const { error } = await supabase.from("settings").upsert({ key: f.key, value: vals[f.key] ?? "" });
      if (error) {
        setBusy(false);
        toast.error(error.message);
        return;
      }
    }
    setBusy(false);
    toast.success("Pengaturan disimpan.");
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["admin-settings"] });
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran logo maksimal 2 MB.");
      return;
    }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const { error } = await supabase.from("settings").upsert({ key: "logo_url", value: base64 });
      setBusy(false);
      if (error) {
        toast.error("Gagal mengunggah logo: " + error.message);
        return;
      }
      toast.success("Logo berhasil diperbarui.");
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    };
    reader.onerror = () => {
      setBusy(false);
      toast.error("Gagal membaca file gambar.");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function removeLogo() {
    setBusy(true);
    const { error } = await supabase.from("settings").upsert({ key: "logo_url", value: "" });
    setBusy(false);
    if (error) {
      toast.error("Gagal menghapus logo: " + error.message);
      return;
    }
    toast.success("Logo dihapus (kembali ke ikon default).");
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["admin-settings"] });
  }

  async function uploadQris(file: File) {
    setBusy(true);
    const path = `qris/qris-${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("payment-proofs").upload(path, file, { upsert: true });
    if (up.error) {
      setBusy(false);
      toast.error("Gagal mengunggah: " + up.error.message);
      return;
    }
    const { error } = await supabase.from("settings").upsert({ key: "qris_image_url", value: path });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Gambar QRIS diperbarui.");
    qc.invalidateQueries();
  }

  return (
    <div className="mt-4 space-y-4">
      {SETTING_FIELDS.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label>{f.label}</Label>
          <Input
            value={vals[f.key] ?? ""}
            placeholder={f.key === "site_name" ? "PadatIlmu" : ""}
            onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
          />
        </div>
      ))}
      <Button onClick={saveSettings} disabled={busy}>
        Simpan pengaturan
      </Button>

      {/* Bagian Upload Logo */}
      <div className="rounded-2xl border border-dashed p-4">
        <Label htmlFor="logo-input" className="flex cursor-pointer flex-col items-center gap-2 py-2 text-center">
          <span className="font-semibold">Unggah Logo Website</span>
          <span className="text-xs text-muted-foreground">Format PNG, JPG, atau SVG (maks 2 MB)</span>
        </Label>
        <input
          id="logo-input"
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={uploadLogo}
        />
        {vals["logo_url"] ? (
          <div className="mt-3 flex flex-col items-center gap-2">
            <img
              src={vals["logo_url"]}
              alt="Logo Preview"
              className="h-10 w-auto object-contain rounded border p-1 bg-background"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={removeLogo}
              disabled={busy}
              className="text-destructive text-xs hover:bg-destructive/10"
            >
              Hapus Logo Khusus
            </Button>
          </div>
        ) : (
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Belum ada logo khusus (menggunakan ikon bawaan & nama "{vals["site_name"] || "PadatIlmu"}").
          </p>
        )}
      </div>

      {/* Bagian Upload QRIS */}
      <div className="rounded-2xl border border-dashed p-4">
        <Label htmlFor="qris" className="flex cursor-pointer flex-col items-center gap-2 py-2 text-center">
          <span className="font-semibold">Unggah gambar QRIS</span>
          <span className="text-xs text-muted-foreground">Foto kode QRIS untuk halaman pembayaran (maks 5 MB)</span>
        </Label>
        <input
          id="qris"
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadQris(f);
            e.target.value = "";
          }}
        />
        {vals["qris_image_url"] && (
          <p className="mt-2 text-center text-xs text-muted-foreground">QRIS saat ini sudah terpasang.</p>
        )}
      </div>
    </div>
  );
}
