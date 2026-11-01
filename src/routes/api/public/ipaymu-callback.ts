import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ipaymuPost } from "@/lib/ipaymu.server";

const Body = z.object({
  trx_id: z.coerce.string().min(1).max(50),
  reference_id: z.string().uuid(),
});

export const Route = createFileRoute("/api/public/ipaymu-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ct = request.headers.get("content-type") ?? "";
        const raw = ct.includes("json")
          ? await request.json().catch(() => ({}))
          : Object.fromEntries((await request.formData().catch(() => new FormData())).entries());
        const parsed = Body.safeParse(raw);
        if (!parsed.success) return new Response("bad request", { status: 400 });

        // Never trust the callback body: re-check the transaction with iPaymu.
        let trx: any;
        try {
          trx = await ipaymuPost("/api/v2/transaction", { transactionId: Number(parsed.data.trx_id) });
        } catch {
          return new Response("verify failed", { status: 502 });
        }
        const d = trx?.Data ?? {};
        const status = Number(d.Status);
        if (String(d.ReferenceId) !== parsed.data.reference_id) return new Response("mismatch", { status: 400 });
        if (status !== 1 && status !== 6) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: enr } = await supabaseAdmin
          .from("enrollments")
          .select("id, amount, status")
          .eq("id", parsed.data.reference_id)
          .maybeSingle();
        if (!enr) return new Response("not found", { status: 404 });
        if (enr.status === "paid") return new Response("ok");
        if (Number(d.Amount ?? d.Total ?? 0) < enr.amount) return new Response("amount mismatch", { status: 400 });

        await supabaseAdmin
          .from("enrollments")
          .update({ status: "paid", note: `iPaymu trx ${parsed.data.trx_id}` })
          .eq("id", enr.id)
          .eq("status", "pending");
        return new Response("ok");
      },
    },
  },
});
