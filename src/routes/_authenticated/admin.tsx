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
import { parseTeachers, teacherHasClass, type Teacher } from "@/lib/teachers";
import { Checkbox } from "@/components/ui/checkbox";
import { TeacherIdentity } from "@/components/TeacherIdentity";
import { PaymentProof } from "@/components/PaymentProof";
import { FILE_MAX_BYTES, fileExt, openPrivateFile } from "@/lib/session-content";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Panel Admin — Padat Ilmu" },
      { name: "description", content: "Kelola kelas, peserta, voucher dan program referral Padat Ilmu." },
      { property: "og:title", content: "Panel Admin — Padat Ilmu" },
      { property: "og:description", content: "Kelola kelas, peserta, voucher dan program referral Padat Ilmu." },
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
      const { data: admin } = await supabase.rpc("has_role", { _user_id: (await supabase.auth.getUser()).data.user?.id ?? "", _role: "admin" });
      if (admin) return data ?? [];
      const { data: settings, error: settingsError } = await supabase.from("settings").select("value").eq("key", "teacher_list").maybeSingle();
      if (settingsError) throw settingsError;
      const { data: user } = await supabase.auth.getUser();
      const teacher = parseTeachers(settings?.value).find((t) => t.email.toLowerCase() === user.user?.email?.toLowerCase());
      return teacher ? (data ?? []).filter((c) => teacherHasClass(teacher, c.id)) : [];
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

  const teacherList = parseTeachers(settings?.["teacher_list"]);
  const userEmail = session?.user.email?.toLowerCase();
  const isTeacher = teacherList.some((t) => t.email.toLowerCase() === userEmail);

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
  const { data: classes = [] } = useClasses();
  const { data: subjects = [] } = useSubjects();
  const teachers = parseTeachers(settings?.["teacher_list"]);
  const [edit, setEdit] = useState<Teacher>({ id: "", name: "", email: "", classIds: [], allClasses: false, createdAt: "" });
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const selected = (id: string) => teacherHasClass(edit, id);
  function toggle(ids: string[], checked: boolean) {
    const current = classes.filter((c) => selected(c.id)).map((c) => c.id);
    setEdit({ ...edit, allClasses: false, classIds: checked ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id)) });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit.name.trim() || !edit.email.trim()) return;
    if (!edit.allClasses && !edit.classIds?.length) { toast.error("Pilih minimal satu kelas."); return; }
    if (teachers.some((t) => t.id !== edit.id && t.email.toLowerCase() === edit.email.trim().toLowerCase())) { toast.error("Email pengajar sudah terdaftar."); return; }
    setBusy(true);
    let uploaded = "";
    try {
      const next = { ...edit, id: edit.id || crypto.randomUUID(), name: edit.name.trim(), email: edit.email.trim().toLowerCase(), createdAt: edit.createdAt || new Date().toISOString() };
      if (photo) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 5 * 1024 * 1024) throw new Error("Pilih foto JPG, PNG atau WebP maksimal 5 MB.");
        uploaded = `${next.id}/${crypto.randomUUID()}.${photo.type.split("/")[1]}`;
        const { error } = await supabase.storage.from("teacher-photos").upload(uploaded, photo);
        if (error) throw error;
        next.photoPath = uploaded;
      }
      const updated = edit.id ? teachers.map((t) => t.id === edit.id ? next : t) : [...teachers, next];
      const { error } = await supabase.from("settings").upsert({ key: "teacher_list", value: JSON.stringify(updated) });
      if (error) throw error;
      if (uploaded && edit.photoPath) await supabase.storage.from("teacher-photos").remove([edit.photoPath]);
      setEdit({ id: "", name: "", email: "", classIds: [], allClasses: false, createdAt: "" }); setPhoto(null);
      await qc.invalidateQueries(); toast.success("Pengajar disimpan.");
    } catch (error) {
      if (uploaded) await supabase.storage.from("teacher-photos").remove([uploaded]);
      toast.error(error instanceof Error ? error.message : "Pengajar belum tersimpan.");
    } finally { setBusy(false); }
  }
  async function remove(t: Teacher) {
    if (!confirm("Hapus akses pengajar ini?")) return;
    const { error } = await supabase.from("settings").upsert({ key: "teacher_list", value: JSON.stringify(teachers.filter((x) => x.id !== t.id)) });
    if (error) { toast.error(error.message); return; }
    if (t.photoPath) await supabase.storage.from("teacher-photos").remove([t.photoPath]);
    await qc.invalidateQueries();
  }
  return <div className="mt-4 space-y-6">
    <h2 className="text-lg font-semibold">{edit.id ? "Ubah pengajar" : "Tambah pengajar"}</h2>
    <form onSubmit={save} className="max-w-xl space-y-4">
      <div><Label htmlFor="teacher-name">Nama pengajar</Label><Input id="teacher-name" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
      <div><Label htmlFor="teacher-email">Email akun pengajar</Label><Input id="teacher-email" type="email" required value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
      <div><Label htmlFor="teacher-photo">Foto pengajar</Label><Input key={edit.id} id="teacher-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />{edit.id && <TeacherIdentity teacherId={edit.id} />}</div>
      <label className="flex items-center gap-2"><Checkbox checked={!!edit.allClasses} onCheckedChange={(v) => setEdit({ ...edit, allClasses: v === true, classIds: v === true ? classes.map((c) => c.id) : [] })} />Semua kelas</label>
      {subjects.map((subject) => {
        const items = classes.filter((c) => c.subject_id === subject.id);
        return <fieldset key={subject.id} className="space-y-2 border-t pt-3">
          <label className="flex items-center gap-2 font-semibold"><Checkbox checked={items.length > 0 && items.every((c) => selected(c.id))} onCheckedChange={(v) => toggle(items.map((c) => c.id), v === true)} />{subject.name}</label>
          {items.map((c) => <label key={c.id} className="ml-6 flex items-center gap-2 text-sm"><Checkbox checked={selected(c.id)} onCheckedChange={(v) => toggle([c.id], v === true)} />{classLevelName(c)}</label>)}
        </fieldset>;
      })}
      {classes.filter((c) => !c.subject_id).map((c) => <label key={c.id} className="flex items-center gap-2"><Checkbox checked={selected(c.id)} onCheckedChange={(v) => toggle([c.id], v === true)} />{c.name}</label>)}
      <Button type="submit" disabled={busy}>{busy ? "Menyimpan..." : "Simpan pengajar"}</Button>
      {edit.id && <Button type="button" variant="outline" onClick={() => { setEdit({ id: "", name: "", email: "", classIds: [], allClasses: false, createdAt: "" }); setPhoto(null); }}>Batal</Button>}
    </form>
    <h2 className="text-lg font-semibold">Daftar pengajar</h2>
    {teachers.map((t) => <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 border-t py-3">
      <div><TeacherIdentity teacherId={t.id} /><p className="font-semibold">{t.name}</p><p className="text-sm text-muted-foreground">{t.email}</p><p className="text-sm">{classes.filter((c) => teacherHasClass(t, c.id)).map((c) => c.name).join(", ") || "Belum ada kelas"}</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => { setEdit({ ...t, allClasses: t.allClasses ?? (!t.classId && !t.classIds), classIds: classes.filter((c) => teacherHasClass(t, c.id)).map((c) => c.id) }); setPhoto(null); }}>Ubah</Button><Button variant="ghost" onClick={() => remove(t)}>Hapus</Button></div>
    </div>)}
  </div>;
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
  available_months?: number[];
};
function KelolaKelas() {
  const { data } = useClasses();
  const { data: subjects = [] } = useSubjects();
  const { data: settings } = useQuery(settingsQuery);
  const teachers = parseTeachers(settings?.["teacher_list"]);
  const qc = useQueryClient();
  const [edit, setEdit] = useState<ClassForm | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "ikhwan" | "akhwat">("all");

  async function save() {
    if (!edit) return;
    if (!edit.name?.trim() || !edit.subject_id) {
      toast.error("Nama kelas dan ilmu wajib diisi.");
      return;
    }
    const { whatsapp_link = "", zoom_link = "", ...rest } = edit;
    const pkgs: string[] = (rest as any).allowed_packages?.length ? (rest as any).allowed_packages : ["monthly"];
    const hasMonthly = pkgs.includes("monthly");
    const hasSession = pkgs.includes("session");
    const sessionOnly = hasSession && !hasMonthly;
    if (hasMonthly && !(Number(rest.price) > 0)) {
      toast.error("Isi harga Paket Bulanan.");
      return;
    }
    if (hasSession && !(Number((rest as any).price_per_session) > 0)) {
      toast.error("Isi harga per sesi untuk Paket Per Sesi.");
      return;
    }
    const payload: any = {
      slug: rest.slug || slugify(rest.name ?? "", "kelas"),
      name: rest.name ?? "",
      tagline: rest.tagline ?? "",
      description: rest.description ?? "",
      goals: rest.goals ?? "",
      schedule: rest.schedule ?? "Setiap Jumat Pukul 19:30 - 21:00 WIB",
      quota: Number(rest.quota ?? 15),
      target_gender: (rest as any).target_gender || "all",
      // Jika hanya Paket Per Sesi yang aktif, harga tampilan kelas = harga 1 sesi
      price: sessionOnly ? Number((rest as any).price_per_session) : Number(rest.price ?? 0),
      price_prefix: rest.price_prefix ?? "",
      is_active: rest.is_active ?? true,
      allowed_packages: pkgs,
      available_sessions: (rest as any).available_sessions ?? [4, 8],
      available_months: (rest as any).available_months?.length ? (rest as any).available_months : [1, 2, 3, 6, 12],
      price_per_session: Number((rest as any).price_per_session ?? 0),
      package_type: sessionOnly ? "session" : "monthly",
      package_weeks: Number(rest.package_weeks || 4),
      package_sessions: sessionOnly ? 1 : Number((rest as any).available_sessions?.[0] ?? 4),
      sort_order: rest.sort_order ?? 99,
      subject_id: edit.subject_id,
      level_number: Number(rest.level_number ?? 1),
      level_label: rest.level_label ?? "Pemula (Dari Nol)",
      levels_label: rest.levels_label ?? `Level ${rest.level_number ?? 1} · Pemula (Dari Nol)`,
      advantages: rest.advantages ?? "",
      teacher_id: rest.teacher_id || null,
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
     <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
  <div className="grid gap-3 sm:grid-cols-2 flex-1">
    <div className="space-y-1">
      <Label>Filter Ilmu</Label>
      <Select value={subjectFilter} onValueChange={setSubjectFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Semua ilmu" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua ilmu</SelectItem>
          {subjects.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div className="space-y-1">
      <Label>Filter Gender</Label>
      <Select
        value={genderFilter}
        onValueChange={(v) => setGenderFilter(v as "all" | "ikhwan" | "akhwat")}
      >
        <SelectTrigger>
          <SelectValue placeholder="Semua target" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua target</SelectItem>
          <SelectItem value="ikhwan">Ikhwan</SelectItem>
          <SelectItem value="akhwat">Akhwat</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>

  <Button
    onClick={() =>
      setEdit({
        is_active: true,
        quota: 15,
        target_gender: "ikhwan",
        level_number: 1,
        level_label: "Pemula (Dari Nol)",
        levels_label: "Level 1 · Pemula (Dari Nol)",
        package_type: "monthly",
        package_weeks: 4,
        package_sessions: 4,
        available_months: [1, 2, 3, 6, 12],
        available_sessions: [4, 8],
        schedule: "Setiap Jumat Pukul 19:30 - 21:00 WIB",
      })
    }
  >
    + Tambah kelas
  </Button>
</div>
      {(data ?? [])
  .filter((c) => subjectFilter === "all" || c.subject_id === subjectFilter)
  .filter((c) => genderFilter === "all" || (c as any).target_gender === genderFilter)
  .map((c) => {
        const pk: string[] = (c as any).allowed_packages ?? ["monthly", "session"];
        const av: number[] = (c as any).available_sessions ?? [4, 8];
        const descPkg = [
          pk.includes("monthly") ? `Bulanan ${rupiah(c.price)}/bulan (pilihan: ${(((c as any).available_months?.length ? (c as any).available_months : [1,2,3,6,12]) as number[]).join(", ")} bulan)` : null,
          pk.includes("session") ? `Per sesi ${rupiah((c as any).price_per_session || 0)}/sesi (pilihan: ${av.join(", ")} sesi)` : null,
        ].filter(Boolean).join(" & ");

        const genderLabel =
          (c as any).target_gender === "ikhwan"
            ? "Ikhwan (Laki-Laki)"
            : (c as any).target_gender === "akhwat"
            ? "Akhwat (Perempuan)"
            : "Semua / Campur";

        return (
          <div key={c.id} className="rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base">{classLevelName(c)}</span>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground font-medium">
                  {genderLabel}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {rupiah(c.price)}/{packageUnit(c)} {c.price_per_session && pk.includes("monthly") ? `· ${rupiah(c.price_per_session)}/sesi` : ""}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Paket: {descPkg || "Belum diatur"}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Jadwal: {c.schedule} · Kuota: {c.quota || 15} santri</div>
              <div className="text-xs text-muted-foreground mt-0.5">Status: {c.is_active ? "Publik" : "Disembunyikan"}</div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setEdit({
                    ...c,
                    whatsapp_link: (((c as any).class_private?.[0] ?? (c as any).class_private) as any)?.whatsapp_link ?? "",
                    zoom_link: (((c as any).class_private?.[0] ?? (c as any).class_private) as any)?.zoom_link ?? "",
                  })
                }
              >
                Ubah
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const { id, created_at, slug, ...clone } = c as any;
                  setEdit({
                    ...clone,
                    name: `${clone.name} (Rombel Baru)`,
                    slug: "",
                    whatsapp_link: (((c as any).class_private?.[0] ?? (c as any).class_private) as any)?.whatsapp_link ?? "",
                    zoom_link: (((c as any).class_private?.[0] ?? (c as any).class_private) as any)?.zoom_link ?? "",
                  });
                }}
              >
                Duplikat
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
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Ubah kelas" : "Tambah kelas"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <SubjectPicker value={edit?.subject_id ?? ""} onChange={(v) => setEdit({ ...edit, subject_id: v })} />
            {f("name", "Nama kelas (mis. Tahsin Dewasa)")}

            {/* Pilihan Target Santri */}
            <div className="space-y-1">
              <Label>Target Santri</Label>
              <Select
                value={(edit as any)?.target_gender || "all"}
                onValueChange={(val) => setEdit({ ...edit, target_gender: val } as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih target santri" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua / Campur</SelectItem>
                  <SelectItem value="ikhwan">Ikhwan (Laki-Laki)</SelectItem>
                  <SelectItem value="akhwat">Akhwat (Perempuan)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pilihan Pengajar */}
            <div className="space-y-1">
              <Label>Pengajar / Guru</Label>
              <Select
                value={edit?.teacher_id || "none"}
                onValueChange={(val) => setEdit({ ...edit, teacher_id: val === "none" ? null : val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih pengajar kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum ditentukan</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Tingkat / Level</Label>
              <Select
                value={String(edit?.level_number ?? 1)}
                onValueChange={(val) => {
                  const num = Number(val);
                  const label = num === 1 ? "Pemula" : num === 2 ? "Umum" : "Lanjutan";
                  setEdit({
                    ...edit,
                    level_number: num,
                    level_label: label,
                    levels_label: `Level ${num} · ${label}`,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih tingkat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Level 1 · Pemula</SelectItem>
                  <SelectItem value="2">Level 2 · Umum</SelectItem>
                  <SelectItem value="3">Level 3 · Lanjutan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {f("tagline", "Tagline singkat")}
            {f("description", "Deskripsi", "area")}
            {f("goals", "Target capaian", "area")}
            {f("advantages", "Keunggulan kelas (pisahkan dengan koma atau baris baru)", "area")}

            {/* Pengaturan Jadwal */}
            <div className="space-y-2 rounded-xl border p-3 bg-muted/30">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jadwal Kelas</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Hari</Label>
                  <Select
                    defaultValue="Jumat"
                    onValueChange={(hari) => {
                      const cur = edit?.schedule || "Setiap Jumat Pukul 19:30 - 21:00 WIB";
                      const jamMatch = cur.match(/Pukul\s+([0-9:.-]+(?:\s*-\s*[0-9:.-]+)?\s*WIB)/i);
                      const jam = jamMatch ? jamMatch[1] : "19:30 - 21:00 WIB";
                      setEdit({ ...edit, schedule: `Setiap ${hari} Pukul ${jam}` });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Pilih hari" /></SelectTrigger>
                    <SelectContent>
                      {["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Ahad"].map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Jam (Mulai - Selesai)</Label>
                  <Select
                    defaultValue="19:30 - 21:00 WIB"
                    onValueChange={(jam) => {
                      const cur = edit?.schedule || "Setiap Jumat Pukul 19:30 - 21:00 WIB";
                      const hariMatch = cur.match(/Setiap\s+([A-Za-z]+)/i);
                      const hari = hariMatch ? hariMatch[1] : "Jumat";
                      setEdit({ ...edit, schedule: `Setiap ${hari} Pukul ${jam}` });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Pilih jam" /></SelectTrigger>
                    <SelectContent>
                      {[
                        "05:30 - 07:00 WIB",
                        "08:00 - 09:30 WIB",
                        "09:30 - 11:00 WIB",
                        "13:30 - 15:00 WIB",
                        "16:00 - 17:30 WIB",
                        "19:30 - 21:00 WIB",
                        "20:00 - 21:30 WIB",
                      ].map((j) => (
                        <SelectItem key={j} value={j}>{j}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Tersimpan: <span className="font-mono font-medium text-foreground">{edit?.schedule || "Setiap Jumat Pukul 19:30 - 21:00 WIB"}</span>
              </p>
            </div>

            {f("quota", "Kuota Maksimal Santri", "number")}
            {f("price_prefix", "Awalan harga (mis. Mulai)")}

            {/* Pilihan Paket Fleksibel */}
            {(() => {
              const currentAllowed: string[] = (edit as any)?.allowed_packages ?? ["monthly"];
              const isMonthly = currentAllowed.includes("monthly");
              const isSession = currentAllowed.includes("session");

              const currentSessions: number[] = (edit as any)?.available_sessions ?? [4, 8];
              const currentMonths: number[] = (edit as any)?.available_months?.length ? (edit as any).available_months : [1, 2, 3, 6, 12];
              const toggleMonthOption = (val: number) => {
                let next = [...currentMonths];
                if (next.includes(val)) {
                  if (next.length === 1) { toast.error("Pilih minimal satu durasi bulanan."); return; }
                  next = next.filter((x) => x !== val);
                } else next.push(val);
                next.sort((a, b) => a - b);
                setEdit({ ...edit, available_months: next } as any);
              };
              const toggleSessionOption = (val: number) => {
                let next = [...currentSessions];
                if (next.includes(val)) {
                  if (next.length === 1) {
                    toast.error("Pilih minimal satu pilihan sesi.");
                    return;
                  }
                  next = next.filter((x) => x !== val);
                } else {
                  next.push(val);
                }
                next.sort((a, b) => a - b);
                setEdit({ ...edit, available_sessions: next } as any);
              };

              const togglePkg = (type: "monthly" | "session") => {
                let next = [...currentAllowed];
                if (next.includes(type)) {
                  if (next.length === 1) {
                    toast.error("Minimal satu jenis paket harus aktif.");
                    return;
                  }
                  next = next.filter((x) => x !== type);
                } else {
                  next.push(type);
                }
                setEdit({ ...edit, allowed_packages: next } as any);
              };

              return (
                <div className="space-y-3 rounded-xl border p-3 bg-muted/20">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Opsi Pembayaran untuk Murid
                  </Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={isMonthly}
                        onChange={() => togglePkg("monthly")}
                      />
                      <span className="text-sm font-medium">Paket Bulanan</span>
                    </label>
                    {isMonthly && (
                      <div className="ml-6 space-y-1">
                        <Label className="text-xs">Harga Paket Bulanan (Rp)</Label>
                        <Input
                          type="number"
                          placeholder="mis. 200000"
                          value={String(edit?.price ?? "")}
                          onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) } as any)}
                        />
                        <Label className="text-xs mt-3 block">Durasi yang tersedia untuk murid:</Label>
                        <div className="grid grid-cols-5 gap-1.5 mt-1">
                          {[1, 2, 3, 6, 12].map((num) => (
                            <label key={num} className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-2 text-xs cursor-pointer">
                              <input type="checkbox" className="rounded" checked={currentMonths.includes(num)} onChange={() => toggleMonthOption(num)} />
                              {num} bln
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">Terpilih: {currentMonths.join(", ") || "-"} bulan.</p>
                      </div>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={isSession}
                        onChange={() => togglePkg("session")}
                      />
                      <span className="text-sm font-medium">Paket Per Sesi</span>
                    </label>
                  </div>

                  {isSession && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Harga per Sesi (Rp)</Label>
                        <Input
                          type="number"
                          placeholder="mis. 50000"
                          value={String((edit as any)?.price_per_session ?? "")}
                          onChange={(e) => setEdit({ ...edit, price_per_session: Number(e.target.value) } as any)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-xs">Jumlah sesi yang dikeluarkan untuk murid (1–30):</Label>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="rounded-md border px-2 py-0.5 text-[11px] font-medium hover:bg-muted"
                              onClick={() => setEdit({ ...edit, available_sessions: Array.from({ length: 30 }, (_, i) => i + 1) } as any)}
                            >
                              Pilih semua (1–30)
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                          {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => {
                            const active = currentSessions.includes(num);
                            return (
                              <button
                                key={num}
                                type="button"
                                onClick={() => toggleSessionOption(num)}
                                className={`px-2 py-1.5 text-xs rounded-md border font-medium transition ${
                                  active
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                {num}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Terpilih: {currentSessions.length ? currentSessions.join(", ") : "-"} sesi. Murid hanya bisa memilih dari angka yang dicentang ini.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

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
  const { data, error: sessionError, refetch } = useQuery({
    queryKey: ["admin-sesi", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data: s, error } = await supabase.from("class_sessions").select("*").eq("class_id", classId).order("level").order("number");
      if (error) throw error;
      const { data: r, error: recordingError } = await supabase.from("session_recordings").select("*").eq("class_id", classId);
      if (recordingError) throw recordingError;
      const { data: pv, error: privateError } = await supabase.from("session_private").select("*").eq("class_id", classId);
      if (privateError) throw privateError;
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
      {sessionError && <p className="text-destructive">{sessionError.message}</p>}
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
                  Paket: {extraEnr.package_type === "session" ? `Per Sesi (${extraEnr.sessions_total || 0} Sesi)` : `Bulanan (${(extraEnr.package_weeks || 4) / 4} bulan)`}
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
  { key: "site_name", label: "Nama Website / Brand (mis. Padat Ilmu)" },
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

  async function savePaymentMode(mode: "both" | "ipaymu" | "manual") {
    setBusy(true);
    const { error } = await supabase.from("settings").upsert({ key: "payment_mode", value: mode });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setVals((v) => ({ ...v, payment_mode: mode }));
    toast.success("Metode pembayaran diperbarui.");
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["admin-settings"] });
  }

  async function uploadApk(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".apk")) {
      toast.error("File harus berformat .apk");
      return;
    }
    setBusy(true);
    const path = `apk/Padat Ilmu-${Date.now()}.apk`;
    const up = await supabase.storage.from("app-files").upload(path, file, {
      upsert: true,
      contentType: "application/vnd.android.package-archive",
    });
    if (up.error) {
      setBusy(false);
      toast.error("Gagal mengunggah APK: " + up.error.message);
      return;
    }
    const { data: pub } = supabase.storage.from("app-files").getPublicUrl(path);
    await supabase.from("settings").upsert([
      { key: "apk_url", value: pub.publicUrl },
      { key: "apk_name", value: file.name },
    ]);
    setBusy(false);
    toast.success("File APK berhasil diunggah!");
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["admin-settings"] });
    e.target.value = "";
  }

  async function removeApk() {
    if (!confirm("Hapus file APK aplikasi?")) return;
    setBusy(true);
    await supabase.from("settings").upsert([
      { key: "apk_url", value: "" },
      { key: "apk_name", value: "" },
    ]);
    setBusy(false);
    toast.success("File APK dihapus.");
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["admin-settings"] });
  }

  return (
    <div className="mt-4 space-y-4">
      {SETTING_FIELDS.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label>{f.label}</Label>
          <Input
            value={vals[f.key] ?? ""}
            placeholder={f.key === "site_name" ? "Padat Ilmu" : ""}
            onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
          />
        </div>
      ))}
      <Button onClick={saveSettings} disabled={busy}>
        Simpan pengaturan
      </Button>

      {/* Metode pembayaran yang ditampilkan ke murid */}
      <div className="space-y-2 rounded-2xl border p-4">
        <Label className="font-semibold">Metode pembayaran untuk murid</Label>
        <p className="text-xs text-muted-foreground">
          Pilih cara bayar yang boleh dipakai murid di halaman pendaftaran. Tersimpan otomatis saat dipilih.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {([
            { v: "both", t: "Keduanya", d: "iPaymu & transfer manual" },
            { v: "ipaymu", t: "Hanya iPaymu", d: "Otomatis (QRIS / VA)" },
            { v: "manual", t: "Hanya Manual", d: "Transfer + bukti bayar" },
          ] as const).map((o) => {
            const active = (["ipaymu", "manual"].includes(vals["payment_mode"]) ? vals["payment_mode"] : "both") === o.v;
            return (
              <button
                key={o.v}
                type="button"
                disabled={busy}
                onClick={() => savePaymentMode(o.v)}
                className={`rounded-2xl border p-3 text-left transition ${
                  active ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "border-border hover:bg-secondary"
                }`}
              >
                <div className="text-sm font-bold">{o.t}</div>
                <div className="text-[11px] text-muted-foreground">{o.d}</div>
              </button>
            );
          })}
        </div>
      </div>

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
            Belum ada logo khusus (menggunakan ikon bawaan & nama "{vals["site_name"] || "Padat Ilmu"}").
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

      {/* Bagian Upload APK Android */}
      <div className="rounded-2xl border border-dashed p-4">
        <Label htmlFor="apk-input" className="flex cursor-pointer flex-col items-center gap-2 py-2 text-center">
          <span className="font-semibold">Unggah File Aplikasi Android (.APK)</span>
          <span className="text-xs text-muted-foreground">Khusus file format .apk aplikasi Padat Ilmu</span>
        </Label>
        <input
          id="apk-input"
          type="file"
          accept=".apk"
          className="hidden"
          disabled={busy}
          onChange={uploadApk}
        />
        {vals["apk_url"] ? (
          <div className="mt-3 flex flex-col items-center gap-2 bg-secondary/50 p-3 rounded-xl border">
            <p className="text-xs font-medium text-foreground">
              File aktif: <span className="text-primary font-semibold">{vals["apk_name"] || "Padat Ilmu.apk"}</span>
            </p>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline" className="text-xs h-7">
                <a href={vals["apk_url"]} target="_blank" rel="noreferrer" download>
                  Uji Unduh APK
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={removeApk}
                disabled={busy}
                className="text-destructive text-xs hover:bg-destructive/10 h-7"
              >
                Hapus APK
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Belum ada APK yang diunggah. Menu unduh di garis tiga akan otomatis muncul setelah APK diunggah.
          </p>
        )}
      </div>
    </div>
  );
}
