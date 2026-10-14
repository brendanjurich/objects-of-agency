// The intake chain shared by brief-intake and selection-intake. The order is the point, and
// it lives only here:
//   origin → CORS → size → JSON → honeypot (logged only) → min-time → Turnstile → parse →
//   links → rate limit → store → mail
// A function supplies its definition (what to parse, which text is echoed into mail, how to
// store, what to send); the outside world comes in as deps, so tests/ runs the whole chain
// in Node with fakes. Nothing here reads the environment or imports an npm: package.

import { clientIp, hasLink } from "./guard.ts";
import { json, ORIGINS, cors } from "./http.ts";
import type { Mail } from "./mail.ts";

// A field the visitor can fix: 400 { error: code }. Any other throw from parse is "fields".
export class Reject extends Error {}

export type Stored = { id: string; ref: string };

export type Definition<Row, S extends Stored = Stored> = {
  name: string; // rate-limit key in intake_hits: "brief", "selection"
  refPrefix: string; // "OA" → OA-3F9A2C
  parse(body: Record<string, unknown>, origin: string): Row;
  echoed(row: Row): (string | null | undefined)[]; // short text echoed into the visitor's mail: no links
  email(row: Row): string | null; // counted by the per-email limit
  store(row: Row, ref: string, origin: string): Promise<S>;
  mail(row: Row, stored: S): Mail[];
};

export type Deps = {
  turnstile(token: string, ip: string | null): Promise<"ok" | "fail" | "unset">;
  underLimit(intake: string, email: string | null, ip: string | null): Promise<boolean>;
  send(m: Mail): Promise<void>;
  now(): number;
};

const MIN_SECONDS = 4;
const MAX_BYTES = 32_000;

export const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
const mkRef = (prefix: string) =>
  prefix + "-" + crypto.getRandomValues(new Uint8Array(3)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "").toUpperCase();

export function intake<Row, S extends Stored>(def: Definition<Row, S>, deps: Deps) {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("origin") ?? "";
    if (!ORIGINS.has(origin)) return new Response("forbidden", { status: 403 });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (req.method !== "POST") return json(405, { error: "method" }, origin);

    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) return json(413, { error: "size" }, origin);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json(400, { error: "json" }, origin); }

    // The honeypot is a signal, never a drop: browser autofill fills an off-screen field
    // whatever its name, and two real people vanished that way (04-10-2026). Turnstile is the
    // gate. Silent drops below are logged with their reason.
    if (typeof body.website === "string" && body.website) console.log("honeypot filled (autofill or bot); continuing to Turnstile");
    const started = Number(body.started_at);
    if (!started || deps.now() - started < MIN_SECONDS * 1000) {
      console.log("dropped: min-time", deps.now() - started);
      return json(200, { ref: mkRef(def.refPrefix) }, origin);
    }
    const ip = clientIp(req);
    const ts = await deps.turnstile(String(body.turnstile ?? ""), ip);
    if (ts === "unset") { console.error("TURNSTILE_SECRET unset; refusing"); return json(503, { error: "config" }, origin); }
    if (ts === "fail") return json(403, { error: "verification" }, origin);

    let row: Row;
    try { row = def.parse(body, origin); }
    catch (e) { return json(400, { error: e instanceof Reject ? e.message : "fields" }, origin); }

    if (def.echoed(row).some(hasLink)) { console.log("rejected: link in echoed text"); return json(400, { error: "link" }, origin); }

    // A broken counter must not cost a lead: Turnstile still gates
    let allowed = true;
    try { allowed = await deps.underLimit(def.name, def.email(row), ip); }
    catch (e) { console.error("rate limit check failed; allowing", e); }
    if (!allowed) { console.log("rejected: rate limit"); return json(429, { error: "limit" }, origin); }

    let stored: S;
    try { stored = await def.store(row, mkRef(def.refPrefix), origin); }
    catch (e) { console.error(e); return json(500, { error: "store" }, origin); }

    // Store before mail. Mail failures are logged, never surfaced as a failed send.
    const sent = await Promise.allSettled(def.mail(row, stored).map((m) => deps.send(m)));
    sent.forEach((s) => { if (s.status === "rejected") console.error("mail", s.reason); });
    return json(200, { ref: stored.ref }, origin);
  };
}
