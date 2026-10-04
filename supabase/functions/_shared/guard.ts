// Intake hardening shared by brief-intake and selection-intake: Turnstile that fails closed,
// per-email and per-IP rate limits counted in Postgres, and link detection for free text
// that is echoed into mail sent from hello@objects.agency.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Generous on purpose: a designer can send several briefs or lists in a sitting, and a
// studio shares one office IP. Counted per intake. Turnstile is the main gate; these cap
// how hard one inbox or one address can lean on it.
export const LIMITS = { emailPerHour: 10, ipPerDay: 20 };

// A secret that isn't set is a misconfiguration, never a pass (fails closed).
export async function turnstile(token: string, ip: string | null): Promise<"ok" | "fail" | "unset"> {
  const secret = Deno.env.get("TURNSTILE_SECRET");
  if (!secret) return "unset";
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret, response: token, remoteip: ip ?? undefined }),
  });
  const j = await r.json();
  return j.success === true ? "ok" : "fail";
}

// Not verified against Supabase's proxy chain (a probe deploy was declined, 04-10-2026).
// If a caller can forge it, the IP limit is bypassable but never locks real visitors out.
export const clientIp = (req: Request): string | null =>
  req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;

// URLs, www., mailto: and bare domains ("evil.com"): anything a mail client would turn into a link.
const LINK = /[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\bmailto:|\b[a-z0-9-]+\.[a-z]{2,24}\b/i;
export const hasLink = (s: string | null | undefined) => !!s && LINK.test(s);

// Emails and IPs are stored as keyed hashes, kept a day, used only for counting.
async function hash(v: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(v));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// true = under the limits (and this send is counted). A database error lets the send
// through and logs it: a broken counter must not cost a lead, and Turnstile still gates.
export async function underLimit(sb: SupabaseClient, intake: string, email: string | null, ip: string | null) {
  const { data, error } = await sb.rpc("intake_allow", {
    p_intake: intake,
    p_email: email ? await hash(email.toLowerCase()) : null,
    p_ip: ip ? await hash(ip) : null,
    p_email_max: LIMITS.emailPerHour,
    p_ip_max: LIMITS.ipPerDay,
  });
  if (error) { console.error("rate limit check failed; allowing", error); return true; }
  return data === true;
}
