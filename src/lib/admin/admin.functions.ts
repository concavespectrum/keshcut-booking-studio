import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// Step 1 of admin sign-in: the Gmail address AND phone must match the allowlist
// (checked in the database). Only then is an email OTP sent.
export const requestAdminOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; phone: string }) => ({
    email: String(d?.email ?? "").trim().toLowerCase().slice(0, 254),
    phone: String(d?.phone ?? "").slice(0, 20),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok, error } = await supabaseAdmin.rpc("kc_admin_check", { p_email: data.email, p_phone: data.phone });
    if (error) throw new Error("Could not check access. Please try again.");
    if (!ok) throw new Error("This email and phone number are not authorized.");
    // Make sure the admin's account exists (ignore "already registered").
    await supabaseAdmin.auth.admin.createUser({ email: data.email, email_confirm: true }).catch(() => null);
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const pub = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { error: e2 } = await pub.auth.signInWithOtp({ email: data.email, options: { shouldCreateUser: false } });
    if (e2) throw new Error(e2.message.includes("rate") ? "Too many codes requested. Please wait a minute." : "Could not send the code. Please try again.");
    return { ok: true };
  });
