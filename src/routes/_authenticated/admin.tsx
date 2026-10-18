import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { rupiah, tanggal } from "@/lib/format";
import { Page, StatusBadge } from "@/components/PageTitle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Panel Admin — Bimbelajar" }] }),
  component: Admin,
});

function useClasses() {
  return useQuery({
    queryKey: ["admin-classes"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("*, class_private(*)").order("sort_order");
      return data ?? [];
    },
  });
}

function Admin() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <Page title="Panel Admin">Memuat...</Page>;
  if (!isAdmin) return <Page title="Panel Admin">Halaman ini khusus admin.</Page>;
  return (
    <Page title="Panel Admin">
      <Tabs defaultValue="dash">
        <TabsList className="flex h-auto w-full flex-wrap">
          <TabsTrigger value="dash">Ringkas</TabsTrigger>
          <TabsTrigger value="kelas">Kelas</TabsTrigger>
          <TabsTrigger value="ilmu">Ilmu</TabsTrigger>
          <TabsTrigger value="sesi">Sesi</TabsTrigger>
          <TabsTrigger value="peserta">Peserta</TabsTrigger>
          <TabsTrigger value="voucher">Voucher</TabsTrigger>
          <TabsTrigger value="atur">Pengaturan</TabsTrigger>
        </TabsList>
        <TabsContent value="dash"><Dashboard /></TabsContent>
        <TabsContent value="kelas"><KelolaKelas /></TabsContent>
        <TabsContent value="ilmu"><KelolaIlmu /></TabsContent>
        <TabsContent value="sesi"><KelolaSesi /></TabsContent>
        <TabsContent value="peserta"><Peserta /></TabsContent>
        <TabsContent value="voucher"><KelolaVoucher /></TabsContent>
        <TabsContent value="atur"><Pengaturan /></TabsContent>
      </Tabs>
    </Page>
  );
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["admin-dash"],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments").select("user_id, amount, status, paid_at");
      const rows = data ?? [];
      const paid = rows.filter((r) => r.status === "paid");
      const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
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

type ClassForm = Partial<Tables<"classes">> & { whatsapp_link?: string; zoom_link?: string };

function KelolaKelas() {
  const { data } = useClasses();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<ClassForm | null>(null);

  async function save() {
    if (!edit) return;
    const { whatsapp_link = "", zoom_link = "", ...rest } = edit;
    const payload = {
      slug: rest.slug || (rest.name ?? "kelas").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: rest.name ?? "", tagline: rest.tagline ?? "", description: rest.description ?? "", goals: rest.goals ?? "",
      levels_label: rest.levels_label ?? "Level 1–2", schedule: rest.schedule ?? "", quota: Number(rest.quota ?? 10),
      price: Number(rest.price ?? 0), price_prefix: rest.price_prefix ?? "", is_active: rest.is_active ?? true,
      sort_order: rest.sort_order ?? 99,
    };
    const res = rest.id
      ? await supabase.from("classes").update(payload).eq("id", rest.id).select().single()
      : await supabase.from("classes").insert(payload).select().single();
    if (res.error) { toast.error(res.error.message); return; }
    const { error } = await supabase.from("class_private").upsert({ class_id: res.data.id, whatsapp_link, zoom_link });
    if (error) { toast.error(error.message); return; }
    toast.success("Kelas disimpan.");
    setEdit(null);
    qc.invalidateQueries();
  }

  const f = (k: keyof ClassForm, label: string, type: "text" | "number" | "area" = "text") => (
    <div className="space-y-1">
      <Label>{label}</Label>
      {type === "area" ? (
        <Textarea value={String(edit?.[k] ?? "")} onChange={(e) => setEdit({ ...edit!, [k]: e.target.value })} />
      ) : (
        <Input type={type} value={String(edit?.[k] ?? "")} onChange={(e) => setEdit({ ...edit!, [k]: e.target.value })} />
      )}
    </div>
  );

  return (
    <div className="mt-4 space-y-3">
      <Button onClick={() => setEdit({ is_active: true })}>+ Tambah kelas</Button>
      {data?.map((c) => (
        <div key={c.id} className="flex items-center justify-between rounded-2xl border bg-card p-4">
          <div>
            <p className="font-semibold">{c.name} {!c.is_active && <span className="text-xs text-muted-foreground">(nonaktif)</span>}</p>
            <p className="text-sm text-muted-foreground">{c.price_prefix} {rupiah(c.price)} · kuota {c.quota}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEdit({ ...c, whatsapp_link: c.class_private?.whatsapp_link ?? "", zoom_link: c.class_private?.zoom_link ?? "" })}>Ubah</Button>
        </div>
      ))}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Ubah kelas" : "Kelas baru"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {f("name", "Nama kelas")}{f("tagline", "Tagline")}{f("description", "Deskripsi", "area")}{f("goals", "Tujuan", "area")}
            {f("levels_label", "Level")}{f("schedule", "Jadwal")}{f("quota", "Kuota", "number")}
            {f("price_prefix", "Awalan harga (mis. Mulai)")}{f("price", "Harga per bulan (Rp)", "number")}
            {f("whatsapp_link", "Link grup WhatsApp")}{f("zoom_link", "Link Zoom")}
            <div className="flex items-center gap-2"><Switch checked={edit?.is_active ?? true} onCheckedChange={(v) => setEdit({ ...edit!, is_active: v })} /><Label>Tampilkan ke publik</Label></div>
            <Button className="w-full" onClick={save}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClassPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useClasses();
  useEffect(() => { if (!value && data?.[0]) onChange(data[0].id); }, [data, value, onChange]);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-xl border bg-card px-3">
      {data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}

function KelolaSesi() {
  const [classId, setClassId] = useState("");
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-sesi", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data: s } = await supabase.from("class_sessions").select("*").eq("class_id", classId).order("level").order("number");
      const { data: r } = await supabase.from("session_recordings").select("*").eq("class_id", classId);
      return (s ?? []).map((x) => ({ ...x, video_url: r?.find((y) => y.session_id === x.id)?.video_url ?? "" }));
    },
  });

  async function addSession() {
    const last = data?.at(-1);
    const level = last ? (last.number >= 16 ? last.level + 1 : last.level) : 1;
    const number = last ? (last.number >= 16 ? 1 : last.number + 1) : 1;
    const { error } = await supabase.from("class_sessions").insert({ class_id: classId, level, number, title: "Sesi baru" });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-sesi", classId] });
  }

  return (
    <div className="mt-4 space-y-3">
      <ClassPicker value={classId} onChange={setClassId} />
      {data?.map((s) => <SessionRow key={s.id} s={s} classId={classId} />)}
      {classId && <Button variant="outline" onClick={addSession}>+ Tambah sesi</Button>}
    </div>
  );
}

function SessionRow({ s, classId }: { s: Tables<"class_sessions"> & { video_url: string }; classId: string }) {
  const [v, setV] = useState(s);
  const qc = useQueryClient();
  async function save() {
    const { error } = await supabase.from("class_sessions").update({ title: v.title, description: v.description, scheduled_at: v.scheduled_at, level: Number(v.level), number: Number(v.number) }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    const r = v.video_url.trim()
      ? await supabase.from("session_recordings").upsert({ session_id: s.id, class_id: classId, video_url: v.video_url.trim() })
      : await supabase.from("session_recordings").delete().eq("session_id", s.id);
    if (r.error) { toast.error(r.error.message); return; }
    toast.success(`Sesi ${v.number} disimpan.`);
    qc.invalidateQueries({ queryKey: ["admin-sesi", classId] });
  }
  return (
    <details className="rounded-2xl border bg-card p-4">
      <summary className="cursor-pointer font-medium">L{s.level} · Sesi {s.number}: {s.title} {s.video_url && "🎬"}</summary>
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Level</Label><Input type="number" value={v.level} onChange={(e) => setV({ ...v, level: Number(e.target.value) })} /></div>
          <div><Label>No. sesi</Label><Input type="number" value={v.number} onChange={(e) => setV({ ...v, number: Number(e.target.value) })} /></div>
        </div>
        <Label>Judul</Label><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        <Label>Deskripsi</Label><Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        <Label>Jadwal (mis. Sabtu, 12 Okt 08.00 WIB)</Label><Input value={v.scheduled_at} onChange={(e) => setV({ ...v, scheduled_at: e.target.value })} />
        <Label>Link rekaman (YouTube / Vimeo / Google Drive)</Label><Input value={v.video_url} onChange={(e) => setV({ ...v, video_url: e.target.value })} placeholder="https://youtu.be/..." />
        <Button size="sm" onClick={save}>Simpan</Button>
      </div>
    </details>
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
    if (error) { toast.error(error.message); return; }
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
      {data?.map((x) => (
        <div key={x.id} className="space-y-2 rounded-2xl border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{x.profile?.full_name || "(tanpa nama)"}</p>
              <p className="text-sm text-muted-foreground">{x.profile?.phone || "-"} · {tanggal(x.created_at)}</p>
              <p className="text-sm">{rupiah(x.amount)} · {x.method}{x.sender_name ? ` · a.n. ${x.sender_name}` : ""}</p>
            </div>
            <StatusBadge status={x.status} />
          </div>
          {x.status === "pending" && (
            <div className="flex gap-2">
              <Button size="sm" variant="success" onClick={() => setStatus(x.id, "paid")}>Konfirmasi lunas</Button>
              <Button size="sm" variant="outline" onClick={() => setStatus(x.id, "rejected")}>Tolak</Button>
            </div>
          )}
          {x.status === "paid" && x.profile && <ProgressEditor p={x.profile} onSave={setLevel} />}
        </div>
      ))}
    </div>
  );
}

function ProgressEditor({ p, onSave }: { p: Tables<"profiles">; onSave: (id: string, l: number, n: string) => void }) {
  const [level, setLevel] = useState(p.current_level ?? 0);
  const [notes, setNotes] = useState(p.test_notes ?? "");
  return (
    <div className="flex flex-wrap items-end gap-2 border-t pt-2">
      <div className="w-20"><Label className="text-xs">Level</Label><Input type="number" value={level} onChange={(e) => setLevel(Number(e.target.value))} /></div>
      <div className="flex-1"><Label className="text-xs">Hasil tes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <Button size="sm" variant="secondary" onClick={() => onSave(p.id, level, notes)}>Simpan</Button>
    </div>
  );
}
