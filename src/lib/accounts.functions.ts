import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { signupSchema, passwordChangeSchema } from "@/lib/account-validation";

export const registerAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signupSchema.parse(input))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Layanan akun belum tersedia.");
    if (new URL(data.origin).origin !== new URL(getRequest().url).origin) throw new Error("Alamat pendaftaran tidak valid.");
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: result, error } = await client.auth.signUp({ email: data.email, password: data.password, options: { emailRedirectTo: data.origin, data: { full_name: data.name, phone: data.phone } } });
    if (error) return { error: error.message, session: null };
    return { error: null, session: result.session ? { access_token: result.session.access_token, refresh_token: result.session.refresh_token } : null };
  });

export const changeAccountPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => passwordChangeSchema.parse(input))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Layanan akun belum tersedia.");
    // A fresh client authenticates only the supplied account, never the browser's existing session.
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: login, error } = await client.auth.signInWithPassword({ email: data.email, password: data.oldPassword });
    if (error || !login.user) return { error: "Email atau password lama salah. Jika lupa, hubungi admin." };
    try {
      const { error: updateError } = await client.auth.updateUser({ password: data.newPassword, current_password: data.oldPassword });
      return { error: updateError ? updateError.message : null };
    } finally {
      await client.auth.signOut({ scope: "local" });
    }
  });