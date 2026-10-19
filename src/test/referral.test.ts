import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { defaultReferralConfig, referralConfigSchema } from "@/lib/referral";

describe("Referral settings", () => {
  it("supports one-way referral without inviter rewards", () => {
    expect(referralConfigSchema.parse({ ...defaultReferralConfig, discount_value: 15, reward_enabled: false }).reward_enabled).toBe(false);
  });
  it("supports optional two-way rewards", () => {
    expect(referralConfigSchema.parse({ ...defaultReferralConfig, discount_value: 10, reward_enabled: true, reward_amount: 20000 }).reward_amount).toBe(20000);
  });
  it("rejects percentages exceeding the price", () => {
    expect(referralConfigSchema.safeParse({ ...defaultReferralConfig, discount_value: 101 }).success).toBe(false);
  });
});

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
describe.skipIf(!url || !key)("Authoritative referral rules", () => {
  it("enforces personal codes, self-referral, one use, optional rewards, payment confirmation and credit reservation", async () => {
    if (!url || !key) throw new Error("Hosted test credentials required");
    const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const minted = JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8"));
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${minted.session.access_token}` } } });
    const { data: original } = await service.from("referral_settings").select("*").maybeSingle();
    const ids: string[] = [];
    let classId = "";
    const check = <T,>(r: { data: T; error: { message: string } | null }): T => {
      if (r.error) throw new Error(r.error.message);
      return r.data;
    };
    try {
      const makeUser = async () => {
        const password = `Ref-${crypto.randomUUID()}-Test!`;
        const email = `referral-${crypto.randomUUID()}@example.com`;
        const created = check(await service.auth.admin.createUser({ email, password, email_confirm: true }));
        if (!created.user) throw new Error("User required");
        ids.push(created.user.id);
        const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        check(await client.auth.signInWithPassword({ email, password }));
        return { client, id: created.user.id };
      };
      const inviter = await makeUser();
      const invitee = await makeUser();
      const a = check(await inviter.client.from("referral_accounts").select("code").single());
      const b = check(await invitee.client.from("referral_accounts").select("code").single());
      expect(a?.code).not.toBe(b?.code);
      const klass = check(await service.from("classes").insert({ name: "Referral test", slug: `ref-test-${crypto.randomUUID()}`, price: 100000 }).select("id").single());
      if (!klass || !a || !b) throw new Error("Test data required");
      classId = klass.id;
      check(await admin.from("referral_settings").upsert({ ...defaultReferralConfig, discount_value: 10, reward_enabled: false, reward_amount: 20000 }));
      const one = check(await invitee.client.rpc("validate_discount", { _class_id: classId, _code: a.code }));
      expect(one?.[0]?.final_amount).toBe(90000);
      expect(one?.[0]?.reward_amount).toBe(0);
      check(await admin.from("referral_settings").update({ reward_enabled: true }).eq("id", true));
      const self = await invitee.client.rpc("validate_discount", { _class_id: classId, _code: b.code });
      expect(self.error?.message).toContain("Kode sendiri");
      const e = check(await invitee.client.from("enrollments").insert({ user_id: invitee.id, class_id: classId, amount: 1, referral_code: a.code }).select("*").single());
      if (!e) throw new Error("Enrollment required");
      expect(e.amount).toBe(90000);
      expect(e.status).toBe("pending");
      expect(check(await inviter.client.rpc("referral_balance", { _user_id: inviter.id }))).toBe(0);
      const reuse = await invitee.client.rpc("validate_discount", { _class_id: classId, _code: a.code });
      expect(reuse.error?.message).toContain("sekali per akun");
      check(await admin.from("enrollments").update({ status: "paid" }).eq("id", e.id));
      check(await admin.from("enrollments").update({ status: "paid" }).eq("id", e.id));
      expect(check(await inviter.client.rpc("referral_balance", { _user_id: inviter.id }))).toBe(20000);
      const rewards = check(await inviter.client.from("referral_rewards").select("amount"));
      expect(rewards).toHaveLength(1);
      const redeem = check(await inviter.client.rpc("validate_discount", { _class_id: classId, _code: "", _use_reward: true }));
      expect(redeem?.[0]?.final_amount).toBe(80000);
      const reserved = check(await inviter.client.from("enrollments").insert({ user_id: inviter.id, class_id: classId, amount: 1, use_referral_reward: true }).select("id").single());
      expect(check(await inviter.client.rpc("referral_balance", { _user_id: inviter.id }))).toBe(0);
      if (!reserved) throw new Error("Reservation required");
      check(await admin.from("enrollments").update({ status: "rejected" }).eq("id", reserved.id));
      expect(check(await inviter.client.rpc("referral_balance", { _user_id: inviter.id }))).toBe(20000);
      check(await admin.from("referral_settings").update({ enabled: false }).eq("id", true));
      const off = await inviter.client.rpc("validate_discount", { _class_id: classId, _code: b.code });
      expect(off.error?.message).toContain("nonaktif");
    } finally {
      if (ids.length) {
        check(await service.from("referral_rewards").delete().in("user_id", ids));
        check(await service.from("enrollments").delete().in("user_id", ids));
      }
      if (classId) check(await service.from("classes").delete().eq("id", classId));
      for (const id of ids) check(await service.auth.admin.deleteUser(id));
      if (original) check(await admin.from("referral_settings").upsert(original));
      else check(await service.from("referral_settings").delete().eq("id", true));
    }
  }, 60000);
});
