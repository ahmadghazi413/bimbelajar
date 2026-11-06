import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminDelete } from "@/components/AdminDelete";
import { classLevelName, classesInSubject } from "@/lib/class-management";
import { settingsQuery } from "@/lib/queries";
import { parseTeachers, teacherHasClass, type Teacher } from "@/lib/teachers";
import { PaymentProof } from "@/components/PaymentProof";
import { FILE_MAX_BYTES, fileExt, openPrivateFile } from "@/lib/session-content";
import { rupiah } from "@/lib/format";
import { Tables } from "@/integrations/supabase/types";
import { classType } from "@/lib/class-type";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  return <KelolaKelas />;
}

function KelolaKelas() {
  const { data } = useClasses();
  const { data: settings } = useQuery(settingsQuery);
  const qc = useQueryClient();
  const [edit, setEdit] = useState<ClassForm | null>(null);

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

    const regularMonthly = Number((rest as any).price_normal ?? rest.price ?? 0);
    const promoMonthly = Number((rest as any).price_promo ?? 0);
    const regularSession = Number((rest as any).price_per_session_normal ?? (rest as any).price_per_session ?? 0);
    const promoSession = Number((rest as any).price_per_session_promo ?? 0);

    if (hasMonthly && !(regularMonthly > 0)) {
      toast.error("Isi harga normal paket bulanan.");
      return;
    }
    if (hasSession && !(regularSession > 0)) {
      toast.error("Isi harga normal per sesi untuk paket per sesi.");
      return;
    }
    if (promoMonthly > 0 && promoMonthly >= regularMonthly) {
      toast.error("Harga promo bulanan harus lebih kecil dari harga normal.");
      return;
    }
    if (promoSession > 0 && promoSession >= regularSession) {
      toast.error("Harga promo per sesi harus lebih kecil dari harga normal.");
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
      price_normal: regularMonthly,
      price_promo: promoMonthly,
      price: sessionOnly ? regularSession : regularMonthly,
      price_prefix: rest.price_prefix ?? "",
      is_active: rest.is_active ?? true,
      allowed_packages: pkgs,
      available_sessions: (rest as any).available_sessions ?? [4, 8],
      available_months: (rest as any).available_months?.length ? (rest as any).available_months : [1, 2, 3, 6, 12],
      price_per_session: regularSession,
      price_per_session_normal: regularSession,
      price_per_session_promo: promoSession,
      package_type: sessionOnly ? "session" : "monthly",
      package_weeks: Number(rest.package_weeks || 4),
      package_sessions: sessionOnly ? 1 : Number((rest as any).available_sessions?.[0] ?? 4),
      sort_order: rest.sort_order ?? 99,
      subject_id: edit.subject_id,
      level_number: Number(rest.level_number ?? 1),
      level_label: rest.level_label ?? "Pemula (Dari Nol)",
      levels_label: rest.levels_label ?? `Level ${rest.level_number ?? 1} · Pemula (Dari Nol)`,
      advantages: rest.advantages ?? "",
      teacher_id: rest.teacher_id ?? null,
    };

    if (!edit.id) {
      const { error } = await supabase.from("classes").insert(payload);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("classes").update(payload).eq("id", edit.id);
      if (error) throw new Error(error.message);
    }

    await qc.invalidateQueries({ queryKey: ["admin-classes"] });
    setEdit(null);
    toast.success(edit.id ? "Kelas berhasil diperbarui." : "Kelas berhasil dibuat.");
  }

  const f = (k: keyof ClassForm, label: string, type: "text" | "number" | "area" = "text") => (
    <div className="space-y-1">
      <Label>{label}</Label>
      {type === "area" ? (
        <Textarea value={String(edit?.[k] ?? "")} onChange={(e) => setEdit({ ...edit, [k]: e.target.value } as any)} />
      ) : (
        <Input
          type={type === "number" ? "number" : "text"}
          value={String(edit?.[k] ?? "")}
          onChange={(e) => setEdit({ ...edit, [k]: type === "number" ? Number(e.target.value) : e.target.value } as any)}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Kelola Kelas</h1>
        <Button onClick={() => setEdit({})}>Tambah kelas</Button>
      </div>

      {edit && (
        <Dialog open={!!edit} onOpenChange={(open) => !open && setEdit(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{edit.id ? "Ubah kelas" : "Tambah kelas"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <SubjectPicker value={edit.subject_id ?? ""} onChange={(v) => setEdit({ ...edit, subject_id: v })} />
              {f("name", "Nama kelas")}
              {f("slug", "Slug")}
              {f("tagline", "Tagline")}
              {f("description", "Deskripsi", "area")}
              {f("goals", "Tujuan", "area")}
              {f("schedule", "Jadwal")}
              {f("quota", "Kuota", "number")}
              {f("price_prefix", "Awalan harga (mis. Mulai)")}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Harga Normal Bulanan (Rp)</Label>
                  <Input
                    type="number"
                    value={String((edit as any)?.price_normal ?? (edit as any)?.price ?? "")}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        price: Number(e.target.value),
                        price_normal: Number(e.target.value),
                      } as any)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Harga Promo Bulanan (Rp)</Label>
                  <Input
                    type="number"
                    value={String((edit as any)?.price_promo ?? "")}
                    onChange={(e) => setEdit({ ...edit, price_promo: Number(e.target.value) } as any)}
                  />
                </div>
              </div>

              <div className="space-y-3 border-t pt-3">
                <Label className="font-medium">Paket Fleksibel</Label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={((edit as any)?.allowed_packages ?? ["monthly"]).includes("monthly")}
                      onCheckedChange={() => {
                        const current = (edit as any)?.allowed_packages ?? ["monthly"];
                        const next = current.includes("monthly") ? current.filter((x: string) => x !== "monthly") : [...current, "monthly"];
                        setEdit({ ...edit, allowed_packages: next } as any);
                      }}
                    />
                    Bulanan
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={((edit as any)?.allowed_packages ?? ["monthly"]).includes("session")}
                      onCheckedChange={() => {
                        const current = (edit as any)?.allowed_packages ?? ["monthly"];
                        const next = current.includes("session") ? current.filter((x: string) => x !== "session") : [...current, "session"];
                        setEdit({ ...edit, allowed_packages: next } as any);
                      }}
                    />
                    Per Sesi
                  </label>
                </div>
              </div>

              {((edit as any)?.allowed_packages ?? ["monthly"]).includes("session") && (
                <div className="space-y-3 border-t pt-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Harga Normal Per Sesi (Rp)</Label>
                      <Input
                        type="number"
                        value={String((edit as any)?.price_per_session_normal ?? (edit as any)?.price_per_session ?? "")}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            price_per_session: Number(e.target.value),
                            price_per_session_normal: Number(e.target.value),
                          } as any)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Harga Promo Per Sesi (Rp)</Label>
                      <Input
                        type="number"
                        value={String((edit as any)?.price_per_session_promo ?? "")}
                        onChange={(e) => setEdit({ ...edit, price_per_session_promo: Number(e.target.value) } as any)}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <Button variant="outline" onClick={() => setEdit(null)}>Batal</Button>
                <Button onClick={save}>Simpan</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
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
  price_normal?: number;
  price_promo?: number;
  price_per_session_normal?: number;
  price_per_session_promo?: number;
};

function SubjectPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: subjects = [] } = useSubjects();
  return (
    <div className="space-y-1">
      <Label>Ilmu</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Pilih ilmu" />
        </SelectTrigger>
        <SelectContent>
          {subjects.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useClasses() {
  return useQuery({
    queryKey: ["admin-classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function slugify(value: string, prefix: string) {
  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

const supabase = (globalThis as any).supabase ?? null;
