import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Dipanggil terjadwal (tiap 1–5 menit): membuat pengingat kelas yang sudah waktunya,
// lalu mengirim semua pesan WhatsApp yang menunggu di antrean (wa_outbox).
async function handle(request: Request) {
  const denied = await authenticateCronRequest(request);
  if (denied) return denied;
  const { runWaDispatch } = await import("@/lib/wa.server");
  try {
    return Response.json(await runWaDispatch());
  } catch (e) {
    console.error("wa-dispatch gagal", e);
    return new Response("dispatch failed", { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/wa-dispatch")({
  server: { handlers: { POST: ({ request }) => handle(request), GET: ({ request }) => handle(request) } },
});
