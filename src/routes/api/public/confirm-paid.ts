import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Body = z.object({
  enrollmentId: z.string().uuid(),
});

export const Route = createFileRoute("/api/public/confirm-paid")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.json().catch(() => ({}));
        const parsed = Body.safeParse(raw);
        if (!parsed.success) return new Response("bad request", { status: 400 });

        const enrollmentId = parsed.data.enrollmentId;

        // 1. Update status pendaftaran menjadi lunas
        const { data: enr, error: enrError } = await supabaseAdmin
          .from("enrollments")
          .update({ status: "paid" })
          .eq("id", enrollmentId)
          .select("id, class_id, user_id")
          .single();

        if (enrError || !enr) {
          return Response.json({ error: enrError?.message ?? "Pendaftaran tidak ditemukan" }, { status: 400 });
        }

        // 2. Masukkan ke antrean wa_outbox (untuk murid dan admin)
        await supabaseAdmin.from("wa_outbox").upsert([
          { kind: "payment_student", ref_id: enrollmentId, dedupe_key: `pay-student-${enrollmentId}`, status: "pending" },
          { kind: "payment_admin", ref_id: enrollmentId, dedupe_key: `pay-admin-${enrollmentId}`, status: "pending" },
        ], { onConflict: "dedupe_key", ignoreDuplicates: true });

        // 3. Langsung kirim via Fonnte
        let stats: any = null;
        try {
          const { runWaDispatch } = await import("@/lib/wa.server");
          stats = await runWaDispatch();
        } catch (e: any) {
          console.error("Gagal dispatch Fonnte:", e);
        }

        return Response.json({ ok: true, stats });
      },
    },
  },
});
