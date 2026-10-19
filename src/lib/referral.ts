import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const referralConfigSchema = z.object({
  id: z.literal(true),
  enabled: z.boolean(),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.number().int().min(0).max(2147483647),
  reward_enabled: z.boolean(),
  reward_amount: z.number().int().min(0).max(2147483647),
}).refine((v) => v.discount_type !== "percent" || v.discount_value <= 100, {
  message: "Diskon persen maksimal 100%.", path: ["discount_value"],
});
export type ReferralConfig = z.infer<typeof referralConfigSchema>;
export const defaultReferralConfig: ReferralConfig = {
  id: true, enabled: true, discount_type: "percent", discount_value: 0,
  reward_enabled: false, reward_amount: 0,
};
export const referralSettingsQuery = queryOptions({
  queryKey: ["referral-settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("referral_settings").select("*").eq("id", true).maybeSingle();
    if (error) throw error;
    return referralConfigSchema.parse(data ?? defaultReferralConfig);
  },
});
export const referralAccountQuery = (userId: string) => queryOptions({
  queryKey: ["referral-account", userId],
  queryFn: async () => {
    const { data, error } = await supabase.from("referral_accounts").select("code").eq("user_id", userId).single();
    if (error) throw error;
    return data;
  },
});
export const referralBalanceQuery = (userId: string) => queryOptions({
  queryKey: ["referral-balance", userId],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("referral_balance", { _user_id: userId });
    if (error) throw error;
    return data ?? 0;
  },
});
export async function discountQuote(classId: string, code: string, useReward: boolean) {
  const { data, error } = await supabase.rpc("validate_discount", {
    _class_id: classId, _code: code.trim(), _use_reward: useReward,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("Tidak dapat menghitung pembayaran.");
  return row;
}