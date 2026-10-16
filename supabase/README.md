# Supabase — backend for the brief (later the quote pipeline)

> Read before any Edge Function change or deploy. Project `nleekoypvxoagnwiqtzz`
> (Free tier, Sydney), linked to this repo. Claude runs deploys.

## Layout

- **Functions:** `brief-intake`, `selection-intake`, `share-list`, `ping`.
- **`functions/_shared/intake.ts`** — the guard chain `brief-intake` and
  `selection-intake` both run. The order lives only here. Each function supplies
  a definition (`brief.ts`, `selection.ts`: fields, echoed text, store, mail);
  its `index.ts` only wires Supabase, Turnstile and Resend in.
- **`_shared/items.ts`** — the saved-configuration validator all three list
  functions use (any unknown key rejected).
- **`_shared/guard.ts`** — hardening helpers the chain calls; the rate limits
  are `LIMITS` here.
- **`_shared/http.ts`** — origin allowlist and CORS. **`_shared/mail.ts`** — the
  Resend sender. **`_shared/share.ts`** — short Saved Items links, stored in
  `shares`, 12 months from last shared.

## Deploy

1. `npm test` (the chain with fakes) and `npm run typecheck` (Deno, via npx).
2. `supabase db push --linked`
3. `supabase functions deploy <name> --project-ref nleekoypvxoagnwiqtzz --no-verify-jwt`

Functions gate themselves: origin allowlist, min-time, Turnstile (fails
closed, a 503, if `TURNSTILE_SECRET` is unset), then a link check and rate
limits. The honeypot is logged only.

## Behaviour the front ends rely on

- **Rate limits** are per intake, counted by `intake_allow()` in `intake_hits`
  (keyed hashes, pruned after a day). Over the limit is an honest 429, never a
  silent "Sent". `share-list` counts the per-IP limit (as intake `share`) only
  when it stores a new list, and has no Turnstile: it sends no mail and
  collects no email.
- **Echoed free text** (name, pieces, project, item names/labels) is rejected
  with a 400 if it holds a URL or bare domain. The brief note is kept and sent
  to the studio in full, and only left out of the visitor's copy.
- Both front ends show their generic "didn't send, email us directly" line for
  any of these.

## Gotchas

- **"Automatically expose new tables" is off** on the project: every new table
  needs an explicit `grant … to service_role` (see
  `migrations/20260909000100_briefs_service_role.sql`).
- **Secrets** (`RESEND_API_KEY`, `TURNSTILE_SECRET`) live in function secrets,
  never in the repo or Webflow.
- **Keepalive:** `.github/workflows/keepalive.yml` pings `ping` every third day
  so the Free project never pauses. It is a bare `curl` with no header: GitHub
  refuses to register any workflow file in this repo containing an
  `apikey:`-style header string, with or without secrets (bisected 09-09-2026).
  `ping` needs none, since it deploys with JWT verification off.
