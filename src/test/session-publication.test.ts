import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"];
describe.skipIf(!url || !key)("Session publication and deletion", () => {
  it("hides draft sessions, publishes them, and prevents deleting an ilmu containing classes", async () => {
    if (!url || !key) throw new Error("Hosted test configuration required");
    const minted = JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8"));
    const admin = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${minted.session.access_token}` } } });
    const anon = createClient(url, key, { auth: { persistSession: false } });
    const check = <T,>(result: { data: T; error: { message: string } | null }) => {
      if (result.error) throw new Error(result.error.message);
      return result.data;
    };
    let subjectId = "";
    let classId = "";
    try {
      const subject = check(await admin.from("subjects").insert({ name: "Publication test", slug: `test-${crypto.randomUUID()}` }).select("id").single());
      subjectId = subject.id;
      const klass = check(await admin.from("classes").insert({ name: "Publication test", slug: `test-${crypto.randomUUID()}`, subject_id: subjectId }).select("id").single());
      classId = klass.id;
      const session = check(await admin.from("class_sessions").insert({ class_id: classId, number: 1, title: "Draft", is_published: false }).select("id").single());
      expect(check(await anon.from("class_sessions").select("id").eq("id", session.id))).toEqual([]);
      check(await admin.from("class_sessions").update({ is_published: true }).eq("id", session.id));
      expect(check(await anon.from("class_sessions").select("id").eq("id", session.id))).toEqual([{ id: session.id }]);
      const blocked = await admin.from("subjects").delete().eq("id", subjectId);
      expect(blocked.error?.message).toContain("Pindahkan atau hapus kelas");
      check(await admin.from("class_sessions").delete().eq("id", session.id));
      expect(check(await admin.from("class_sessions").select("id").eq("id", session.id))).toEqual([]);
    } finally {
      if (classId) check(await admin.from("classes").delete().eq("id", classId));
      if (subjectId) check(await admin.from("subjects").delete().eq("id", subjectId));
    }
  }, 30000);
});