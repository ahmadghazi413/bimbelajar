import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ipaymuPost } from "./ipaymu.server";

const Input = z.object({
  classId: z.string().uuid(),
  amount: z.number().int().positive(),
  packageType: z.string().max(20).optional(),
  sessionsTotal: z.number().int().min(0).max(100).optional(),
  voucherCode: z.string().max(50).nullable().optional(),
  referralCode: z.string().max(50).nullable().optional(),
  useReward: z.boolean().optional(),
  origin: z.string().url(),
});

export const createIpaymuPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    // Enrollment is created as the user; DB triggers recompute the authoritative amount.
    const { data: enr, error } = await supabase
      .from("enrollments")
      .insert({
        user_id: userId,
        class_id: data.classId,
        amount: data.amount,
        method: "iPaymu",
        package_type: data.packageType,
        sessions_total: data.sessionsTotal,
        voucher_code: data.voucherCode ?? null,
        referral_code: data.referralCode ?? null,
        use_referral_reward: data.useReward ?? false,
      } as any)
      .select("id, amount, class_id")
      .single();
    if (error || !enr) throw new Error(error?.message ?? "Pendaftaran gagal dibuat.");

    const { data: cls } = await supabase.from("classes").select("title, slug").eq("id", enr.class_id).single();
    const email = (claims as any)?.email ?? "murid@padatilmu.com";
    const res = await ipaymuPost<any>("/api/v2/payment", {
      product: [cls?.title ?? "Kelas"],
      qty: [1],
      price: [enr.amount],
      referenceId: enr.id,
      returnUrl: `${data.origin}/kelas-saya`,
      cancelUrl: `${data.origin}/bayar/${cls?.slug ?? ""}`,
      notifyUrl: `${data.origin}/api/public/ipaymu-callback`,
      buyerName: email.split("@")[0],
      buyerEmail: email,
    });
    const url = res?.Data?.Url as string | undefined;
    if (!url) throw new Error("Link pembayaran tidak tersedia.");
    return { url };
  });
