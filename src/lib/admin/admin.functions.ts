import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { bookingsCsv, type ExportBooking } from "./csv";

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

// Every authenticated session must also pass the allowlisted phone check.
// Email links and independently minted auth tokens cannot bypass this RLS boundary.
export const verifyAdminSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ phone: z.string().min(9).max(20) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = typeof context.claims.email === "string" ? context.claims.email : "";
    const rawSession = context.claims.session_id;
    const issuedAt = context.claims.iat;
    if (rawSession != null && !z.string().uuid().safeParse(rawSession).success) throw new Error("Please sign in again.");
    if (rawSession == null && (typeof issuedAt !== "number" || !Number.isSafeInteger(issuedAt))) throw new Error("Please sign in again.");
    // Managed preview tokens lack session_id; bind their grant to signed issuer time instead.
    const sessionId = typeof rawSession === "string" ? rawSession : crypto.randomUUID();
    const { data: ok, error } = await supabaseAdmin.rpc("kc_admin_check", { p_email: email, p_phone: data.phone });
    if (error || !ok) throw new Error("This email and phone number are not authorized.");
    const { error: saveError } = await supabaseAdmin.from("admin_verified_sessions").upsert({
      session_id: sessionId, user_id: context.userId,
      issued_at: rawSession == null && typeof issuedAt === "number" ? issuedAt : null,
      expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    });
    if (saveError) throw new Error("Could not verify access. Please try again.");
    return { ok: true };
  });

export const exportBookingTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin, error } = await context.supabase.rpc("is_admin");
    if (error || !admin) throw new Error("Not authorized.");
    const rows: ExportBooking[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error: queryError } = await context.supabase.from("bookings")
        .select("ticket_id,starts_at,ends_at,status,custom_service,customers(name,phone),booking_services(name)")
        .order("id").range(offset, offset + 999);
      if (queryError) throw new Error("Could not export tickets. Please try again.");
      rows.push(...(data as unknown as ExportBooking[]));
      if (data.length < 1000) break;
    }
    return { csv: bookingsCsv(rows) };
  });

export const deleteBookingTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("kc_admin_delete_ticket", { p_id: data.id });
    if (error) throw new Error("Could not delete ticket. Check your access and try again.");
    return { ok: true };
  });
