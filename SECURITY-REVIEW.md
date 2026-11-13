# KeshCut verification

## Checked
- Customer identity uses a random HttpOnly, Secure, SameSite cookie; only its hash is stored.
- Customer RPCs are inaccessible to anonymous and authenticated Data API callers. Session-scoped reads prevent a matching phone on another device from revealing bookings or messages.
- Customer writes validate action shapes and reject cross-origin requests. Custom details are mandatory for Others in the database, including edits.
- Admin RLS now requires a matching allowlisted email and an expiring phone-verified session grant created only on the server. Email-only auth tokens cannot read or delete tickets. Managed preview tokens are bound to signed issuance time when no auth session ID is available.
- CSV export is authenticated, rechecks admin access, reads through RLS, exports all pages, and escapes spreadsheet formulas.
- Permanent deletion checks admin rights inside SQL, removes only the ticket and dependent service rows, corrects completed visits, preserves customer/chat records, and notifies the customer's live channel.
- Browser checks passed: multi-service booking, mandatory Others, editing/removing details, overlapping requests, same-phone different-browser isolation, chat, live admin reply, CSV download, cancelled/confirmed deletion, search/history updates, live customer deletion, and mobile layout.
- Direct anonymous data reads, deletion and unauthenticated export were refused. Unit and routing tests passed.

## Limitations and assumptions
- Real email-code delivery was not exercised; tests used the platform's managed developer session followed by real phone verification.
- The platform requires `.env` to remain tracked and refuses removal/ignore changes. It contains public URL/key settings only; no service-role key or other private credential was found. Private keys are loaded only inside server handlers.
- New training/course/Other appointments use provisional 30-minute durations and no published prices, matching the existing scheduling assumptions until the studio supplies actual durations.
- Simple math verification intentionally remains client-side and is not a security or abuse-prevention boundary.
- Customer live channels contain data-free signals on random topics; they contain no booking or message contents.