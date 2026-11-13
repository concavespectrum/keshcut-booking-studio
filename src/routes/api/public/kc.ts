import { createFileRoute } from "@tanstack/react-router";
import { cleanMessage, normalizePhone, customServiceDetail } from "@/lib/kc-shared";
import { z } from "zod";

// Customer API for the static site. Identity = HttpOnly session cookie (random token,
// only its SHA-256 is stored). All rules (ownership, availability, prices) live in SQL RPCs.
const COOKIE = "kc_sid";
const ERR = {
  invalid_phone: [400, "Please enter a valid Nepali mobile number."],
  invalid_name: [400, "Please enter your name."],
  invalid_services: [400, "Please choose at least one service."],
  invalid_custom_service: [400, "Please describe the service you need (1–500 characters)."],
  invalid_time: [400, "Please choose an available time."],
  outside_hours: [400, "That booking would run past closing time. Pick an earlier time or fewer services."],
  slot_taken: [409, "Sorry, that time was just taken. Please choose another time."],
  too_many: [429, "You already have 3 upcoming bookings."],
  phone_mismatch: [403, "This browser is linked to a different phone number."],
  no_session: [401, "Please make a booking or start a chat first."],
  not_found: [404, "Booking not found."],
  locked: [409, "This booking can no longer be changed."],
  invalid_message: [400, "Messages must be 1 to 1000 characters of text."],
  rate_limited: [429, "You're sending messages too fast. Please wait a moment."],
} satisfies Record<string, [number, string]>;
type ErrKey = keyof typeof ERR;
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("book"), start: z.string().datetime({ offset: true }), services: z.array(z.number().int().min(1).max(13)).min(1).max(6), custom: z.string().max(500).optional(), name: z.string().trim().min(1).max(80), phone: z.string().min(9).max(20) }).strict(),
  z.object({ action: z.literal("update"), ticket: z.string().regex(/^KC-[A-Z2-9]{6}$/), services: z.array(z.number().int().min(1).max(13)).min(1).max(6), custom: z.string().max(500).optional() }).strict(),
  z.object({ action: z.literal("cancel"), ticket: z.string().regex(/^KC-[A-Z2-9]{6}$/) }).strict(),
  z.object({ action: z.literal("message"), body: z.string().min(1).max(1000), name: z.string().max(80).optional(), phone: z.string().max(20).optional() }).strict(),
]);
type Body = z.infer<typeof bodySchema>;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

async function sha256Hex(s: string) {
  const b = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return "\\x" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function readCookie(req: Request) {
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)kc_sid=([A-Za-z0-9_-]{20,})/);
  return m ? m[1] : null;
}
function sameOrigin(req: Request) {
  const o = req.headers.get("origin");
  return o === new URL(req.url).origin && req.headers.get("sec-fetch-site") !== "cross-site";
}
async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
function fail(error: { message?: string; code?: string } | null) {
  if (error?.code === "23P01") return json({ error: ERR.slot_taken[1], code: "slot_taken" }, 409);
  const key = (Object.keys(ERR) as ErrKey[]).find((k) => error?.message?.includes(k));
  if (key) return json({ error: ERR[key][1], code: key }, ERR[key][0]);
  console.error("kc rpc error", error);
  return json({ error: "Something went wrong. Please try again." }, 500);
}
const ids = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < 100))].slice(0, 6) : [];

export const Route = createFileRoute("/api/public/kc")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const sb = await db();
        const day = url.searchParams.get("busy");
        if (day) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return json({ error: "bad date" }, 400);
          const { data, error } = await sb.rpc("kc_busy", { p_day: day });
          return error ? fail(error) : json({ busy: data }, 200, { "cache-control": "public, max-age=15" });
        }
        const tok = readCookie(request);
        if (!tok) return json({ me: null });
        const h = await sha256Hex(tok);
        if (url.searchParams.has("messages")) {
          const after = Number(url.searchParams.get("after") || 0);
          if (!Number.isSafeInteger(after) || after < 0) return json({ error: "Invalid message cursor" }, 400);
          const { data, error } = await sb.rpc("kc_messages", { p_hash: h, p_after: after });
          return error ? fail(error) : json({ messages: data });
        }
        const { data, error } = await sb.rpc("kc_me", { p_hash: h });
        return error ? fail(error) : json({ me: data });
      },
      POST: async ({ request }) => {
        if (!sameOrigin(request)) return json({ error: "Forbidden" }, 403);
        let body: Body;
        try {
          if (Number(request.headers.get("content-length") || 0) > 8192) return json({ error: "Request too large" }, 413);
          const text = await request.text();
          if (text.length > 8192) return json({ error: "Request too large" }, 413);
          body = bodySchema.parse(JSON.parse(text));
        } catch {
          return json({ error: "Bad request" }, 400);
        }
        const sb = await db();
        const tok = readCookie(request);
        const h = tok ? await sha256Hex(tok) : null;
        const fresh = newToken();
        const freshHash = await sha256Hex(fresh);
        const setCookie = {
          "set-cookie": `${COOKIE}=${fresh}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`,
        };
        const name = "name" in body && typeof body.name === "string" ? body.name.trim() : "";
        const phoneRaw = "phone" in body && typeof body.phone === "string" ? body.phone : "";
        if (!h && body.action !== "cancel" && body.action !== "update" && !normalizePhone(phoneRaw))
          return json({ error: ERR.invalid_phone[1] }, 400);

        if (body.action === "book") {
          const custom = customServiceDetail(body.services, body.custom);
          if (!custom.ok) return json({ error: ERR.invalid_custom_service[1] }, 400);
          const start = new Date(String(body.start));
          if (isNaN(start.getTime())) return json({ error: ERR.invalid_time[1] }, 400);
          const { data, error } = await sb.rpc("kc_create_booking_details", {
            p_hash: h as string, p_new_hash: freshHash, p_name: name, p_phone: phoneRaw,
            p_services: ids(body.services), p_start: start.toISOString(),
             p_custom: custom.detail,
          });
          if (error) return fail(error);
          const d = data as { ticket_id: string; session_created: boolean };
          return json({ ticket_id: d.ticket_id }, 200, d.session_created ? setCookie : {});
        }
        if (body.action === "update" || body.action === "cancel") {
          if (!h) return json({ error: ERR.no_session[1] }, 401);
          const ticket = String(body.ticket || "").slice(0, 12);
          const custom = body.action === "update" ? customServiceDetail(body.services, body.custom) : { ok: true as const, detail: "" };
          if (!custom.ok) return json({ error: ERR.invalid_custom_service[1] }, 400);
          const { error } =
            body.action === "update"
              ? await sb.rpc("kc_update_service_details", { p_hash: h, p_ticket: ticket, p_services: ids(body.services), p_custom: custom.detail })
              : await sb.rpc("kc_cancel", { p_hash: h, p_ticket: ticket });
          return error ? fail(error) : json({ ok: true });
        }
        if (body.action === "message") {
          const text = cleanMessage(body.body);
          if (!text) return json({ error: ERR.invalid_message[1] }, 400);
          const { data, error } = await sb.rpc("kc_send", {
            p_hash: h as string, p_new_hash: freshHash, p_name: name, p_phone: phoneRaw, p_body: text,
          });
          if (error) return fail(error);
          const d = data as { id: number; session_created: boolean };
          return json({ id: d.id }, 200, d.session_created ? setCookie : {});
        }
        return json({ error: "Unknown action" }, 400);
      },
    },
  },
});
