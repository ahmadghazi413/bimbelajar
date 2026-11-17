import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { publicTeachersQuery } from "@/components/TeacherIdentity";
import { classTeacherIds } from "@/lib/schedule";
import { categoryLabel, scheduleLines } from "@/lib/class-category";
import { rupiah } from "@/lib/format";
import { getPackagePrice, packageCounts, packageLabel, startingPrice, unitWeeks } from "@/lib/package-prices";
import { classDetailQuery, settingsQuery } from "@/lib/queries";
import { parseTeachers } from "@/lib/teachers";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/kelas/$slug")({
  loader: async ({ context, params }) => {
    const c = await context.queryClient.ensureQueryData(classDetailQuery(params.slug));
    if (!c) throw notFound();

    // Muat rombel lain dalam subject, level, dan gender yang sama
    let siblingQuery = supabase
      .from("classes")
      .select("*")
      .eq("subject_id", c.subject_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (c.level_number) siblingQuery = siblingQuery.eq("level_number", c.level_number);
    const targetGender = c.target_gender || "all";
siblingQuery = siblingQuery.eq("target_gender", targetGender);

    const [{ data: siblings }, { data: counts }, settings, { data: subject }] = await Promise.all([
      siblingQuery,
      supabase.rpc("get_class_enrollment_counts"),
      context.queryClient.ensureQueryData(settingsQuery),
      c.subject_id
        ? supabase.from("subjects").select("id, name, slug").eq("id", c.subject_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const enrollmentMap: Record<string, number> = {};
    for (const r of (counts as any) ?? []) enrollmentMap[r.class_id] = r.enrolled_count;

    const teacherMap: Record<string, string> = {};
    const teacherList = parseTeachers((settings as any)?.["teacher_list"]);
    for (const t of teacherList) teacherMap[t.id] = t.name;

    return {
      c,
      siblings: siblings && siblings.length > 0 ? siblings : [c],
      enrollmentMap,
      teacherMap,
      subject,
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: loaderData ? `${loaderData.c.name} — PadatIlmu` : "Kelas — PadatIlmu" },
      { name: "description", content: loaderData?.c.tagline ?? "Detail kelas ngaji online." },
      { property: "og:title", content: loaderData ? `${loaderData.c.name} — PadatIlmu` : "Kelas — PadatIlmu" },
      { property: "og:description", content: loaderData?.c.tagline ?? "Detail kelas ngaji online." },
    ],
  }),
  notFoundComponent: () => <p className="p-10 text-center">Kelas tidak ditemukan.</p>,
  component: ClassDetailPage,
});

function ClassDetailPage() {
  const data = Route.useLoaderData();
  const initialClass = data.c;
  const rombelList = data.siblings;
  const enrollmentMap = data.enrollmentMap;
  const teacherMap = data.teacherMap;
  const subject = data.subject;
  const { data: publicTeachers } = useQuery(publicTeachersQuery);

  const [selectedId, setSelectedId] = useState<string>(initialClass.id);
  const activeClass = rombelList.find((item: any) => item.id === selectedId) ?? initialClass;

  const targetGender = activeClass.target_gender;
  const genderLabel = targetGender === "ikhwan" ? "Ikhwan · Laki-laki" : targetGender === "akhwat" ? "Akhwat · Perempuan" : null;
  const start = startingPrice(activeClass);
  const regularPrice = start?.normal ?? 0;
  const hasPromo = !!start?.hasPromo;
  const finalPrice = start?.final ?? 0;
  const allowedKinds: ("monthly" | "session")[] = (activeClass.allowed_packages?.length ? activeClass.allowed_packages : ["monthly"]);
  const priceRows = allowedKinds.flatMap((kind) => {
    const counts = packageCounts(activeClass, kind);
    return (counts.length ? counts : [1]).map((count) => ({
      key: `${kind}-${count}`,
      label: packageLabel(kind, count, unitWeeks(activeClass)),
      ...getPackagePrice(activeClass, kind, count),
    }));
  }).filter((r) => r.final > 0);

  const activeEnrolled = enrollmentMap[activeClass.id] ?? 0;
  const activeQuota = activeClass.quota || 15;
  const isActiveFull = Math.max(0, activeQuota - activeEnrolled) <= 0;

  // Judul singkat: "Kelas Tahsin" / "Kelas Pra Tahsin" (kelompok Ikhwan/Akhwat tampil sebagai label).
  const title = /tahsin/i.test(activeClass.name) ? `Kelas ${categoryLabel(activeClass)}` : activeClass.name.replace(/[\s\-_]+Kelas\s+[A-Za-z0-9]+$/i, "").trim();

  const teachersOf = (item: any) =>
    classTeacherIds(item).map((id) => {
      const t = publicTeachers?.find((x) => x.id === id);
      return { id, name: t?.name ?? teacherMap[id] ?? "", photoUrl: t?.photoUrl as string | undefined };
    }).filter((t) => t.name || t.photoUrl);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
      <Link
        to={subject?.slug ? "/ilmu/$slug" : "/kelas"}
        params={subject?.slug ? { slug: subject.slug } : undefined}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/75"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Kembali ke katalog{subject?.name ? ` ${subject.name}` : ""}
      </Link>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{categoryLabel(activeClass)}</span>
        {genderLabel && (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${targetGender === "akhwat" ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"}`}>
            {genderLabel}
          </span>
        )}
      </div>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-primary sm:text-4xl">{title}</h1>
      {activeClass.tagline && <p className="mt-3 text-base leading-relaxed text-muted-foreground">{activeClass.tagline}</p>}

      {/* PILIH JADWAL: tiap bar memuat foto pengajar, hari, dan jam */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-foreground sm:text-xl">Pilih jadwal belajar</h2>
        <div className="mt-3 space-y-3">
          {rombelList.map((item: any) => {
            const isSelected = item.id === activeClass.id;
            const enrolled = enrollmentMap[item.id] ?? 0;
            const quota = item.quota || 15;
            const remaining = Math.max(0, quota - enrolled);
            const isFull = remaining <= 0;
            const teachers = teachersOf(item);
            const lines = scheduleLines([item]);
            const first = teachers[0];

            return (
              <button
                key={item.id}
                type="button"
                disabled={isFull}
                onClick={() => setSelectedId(item.id)}
                className={[
                  "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200",
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                    : isFull
                      ? "cursor-not-allowed border-dashed bg-muted/30 opacity-60"
                      : "bg-card hover:border-primary/40 hover:bg-secondary/20",
                ].join(" ")}
              >
                {first?.photoUrl ? (
                  <img src={first.photoUrl} alt={first.name || "Pengajar"} className="h-12 w-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">
                    {(first?.name || "?").slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  {(lines.length ? lines : ["Jadwal belum ditentukan"]).map((t) => (
                    <span key={t} className="block font-semibold text-foreground">{t}</span>
                  ))}
                  {teachers.length > 0 && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{teachers.map((t) => t.name).filter(Boolean).join(", ")}</span>
                  )}
                  <span className={`mt-0.5 block text-xs ${isFull ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                    {isFull ? `Penuh (${enrolled}/${quota})` : `Sisa ${remaining} kursi`}
                  </span>
                </span>
                <span
                  className={[
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 bg-background",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {isSelected && <span className="h-2 w-2 rounded-full bg-current" />}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* INVESTASI & DAFTAR: langsung di bawah pilihan jadwal */}
      <section className="mt-6 rounded-3xl border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Investasi belajar</p>
        <p className="mt-2 font-display text-3xl font-bold text-primary">
          {activeClass.price_prefix && <span className="mr-1 text-xs font-medium text-muted-foreground">{activeClass.price_prefix}</span>}
          {hasPromo ? (
            <>
              <span className="mr-2 text-base font-medium text-muted-foreground line-through">{rupiah(regularPrice)}</span>
              <span>{rupiah(finalPrice)}</span>
            </>
          ) : (
            <span>{rupiah(regularPrice)}</span>
          )}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">mulai dari paket {start?.label ?? ""}</p>

        {priceRows.length > 1 && (
          <ul className="mt-3 space-y-1.5 rounded-2xl bg-secondary/40 p-3 text-sm">
            {priceRows.map((r) => (
              <li key={r.key} className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-semibold text-foreground">
                  {r.hasPromo && <span className="mr-1.5 text-xs font-normal text-muted-foreground line-through">{rupiah(r.normal)}</span>}
                  {rupiah(r.final)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Button
          asChild={!isActiveFull}
          disabled={isActiveFull}
          variant="hero"
          size="lg"
          className="mt-5 w-full text-base font-semibold"
        >
          {isActiveFull ? (
            <span>Kelas Penuh — Pilih Jadwal Lain</span>
          ) : (
            <Link to="/bayar/$slug" params={{ slug: activeClass.slug }}>
              Daftar kelas ini
            </Link>
          )}
        </Button>
      </section>
    </div>
  );
}
