<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- The homepage is the original static site (`src/site/index.html` + `public/js|css`), served raw by the `/` route; edit it in place, never port it to React — preserves the hand-built design and animations.
- Customers have no accounts: identity is the HttpOnly `kc_sid` cookie (only its SHA-256 is stored in `customer_sessions`); a phone number alone never grants access.
- All customer reads/writes go through `/api/public/kc` → `kc_*` SECURITY DEFINER SQL functions (service_role only) — one round trip per action, rules enforced in the database.
- Booking overlap is prevented by the `bookings_no_overlap` exclusion constraint; prices and durations come only from `public.services`.
- Customer live updates use data-free `realtime.send` pings on a random per-session topic, then refetch; admins use RLS-filtered postgres_changes.
- Admin access requires an allowlisted email and phone both before OTP and for each authenticated session; `is_admin()` checks a server-created, expiring session grant in RLS so email-only links cannot bypass phone verification.
- Custom-service booking wrappers validate and store details atomically with the existing customer RPCs; reuse server-owned service durations and ownership checks.
- Ticket exports use authenticated server functions with RLS and CSV formula escaping; permanent deletion uses an admin-checking SQL function to cascade only ticket services and update visit counts.
