// selection-intake — "Email me this list" on /saved-items.
// Browser → fetch → here → insert selections row → two Resend emails → { ref }.
// Same guard chain as brief-intake: CORS → min-time (honeypot logged only) → Turnstile → validate → links → rate limit → insert → mail.
// The emailed link is rebuilt here from the validated items, never taken from the browser,
// and carries no price (W07). Secrets: RESEND_API_KEY, TURNSTILE_SECRET (shared with brief-intake).

import { createClient } from "npm:@supabase/supabase-js@2";
import { describe, type Item, parseItems, shareParam } from "../_shared/items.ts";
import { clientIp, hasLink, turnstile, underLimit } from "../_shared/guard.ts";

const ORIGINS = new Set([
  "https://objects.agency",
  "https://www.objects.agency",
  "https://oa-v5.webflow.io",
]);
const STUDIO_TO = "hello@objects.agency";
const FROM = "Objects of Agency <hello@objects.agency>";
const MIN_SECONDS = 4;
const PATH = /^\/[a-z0-9\/-]{1,80}$/;

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Vary": "Origin",
});
const json = (status: number, body: unknown, origin: string) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors(origin) } });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
const mkRef = () => "SL-" + crypto.getRandomValues(new Uint8Array(3)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "").toUpperCase();

async function send(to: string, subject: string, html: string, text: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) { console.warn("RESEND_API_KEY unset; skipping mail to", to); return; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html, text, reply_to: STUDIO_TO }),
  });
  if (!r.ok) console.error("resend", r.status, await r.text());
}

function visitorEmail(project: string, items: Item[], link: string) {
  const title = project ? `Your saved pieces — ${project}` : "Your saved pieces";
  const lines = items.map(describe);
  const html = `<p>Here's the list you saved at objects.agency, so it's with you wherever you are.</p>
<h3>${esc(title)}</h3>
<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
<p><a href="${esc(link)}">Open the list</a> — from there you can add it to your saved items on any device, share it, or start a brief.</p>
<p>Indicative prices are on the site; they aren't included here.</p>
<p>Brendan Jurich<br>Objects of Agency · Perth</p>
<p style="font-size:12px;color:#888">You're receiving this because you asked for it at objects.agency. We keep saved lists for twelve months. <a href="https://objects.agency/privacy">Privacy</a></p>`;
  const text = `Here's the list you saved at objects.agency.\n\n${title}\n${lines.map((l) => `- ${l}`).join("\n")}\n\nOpen the list: ${link}\n\nIndicative prices are on the site; they aren't included here.\n\nBrendan Jurich\nObjects of Agency · Perth`;
  return { subject: title, html, text };
}

function studioEmail(email: string, project: string, items: Item[], link: string, ref: string, id: string) {
  const text = [`Email: ${email}`, `Project: ${project}`, ...items.map((i) => `Piece: ${describe(i)}`), `List: ${link}`].join("\n") + `\n\nrow: ${id}`;
  return { subject: `Saved list ${ref} · ${items.length} piece${items.length === 1 ? "" : "s"}`, html: `<pre>${esc(text)}</pre>`, text };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (!ORIGINS.has(origin)) return new Response("forbidden", { status: 403 });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json(405, { error: "method" }, origin);

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 32_000) return json(413, { error: "size" }, origin);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "json" }, origin); }

  // The honeypot is a signal, never a drop: browser autofill fills an off-screen field
  // whatever its name, and two real people vanished that way (04-10-2026). Turnstile is the
  // gate. Silent drops below are logged with their reason.
  if (typeof body.website === "string" && body.website) console.log("honeypot filled (autofill or bot); continuing to Turnstile");
  const started = Number(body.started_at);
  if (!started || Date.now() - started < MIN_SECONDS * 1000) { console.log("dropped: min-time", Date.now() - started); return json(200, { ref: mkRef() }, origin); }
  const ip = clientIp(req);
  const ts = await turnstile(String(body.turnstile ?? ""), ip);
  if (ts === "unset") { console.error("TURNSTILE_SECRET unset; refusing"); return json(503, { error: "config" }, origin); }
  if (ts === "fail") return json(403, { error: "verification" }, origin);

  let email: string, project: string, items: Item[], path: string;
  try {
    email = typeof body.email === "string" ? body.email.trim() : "";
    if (!emailOk(email)) return json(400, { error: "email" }, origin);
    project = typeof body.project === "string" ? body.project.trim().slice(0, 120) : "";
    if (/[\r\n]/.test(project)) throw new Error("project");
    items = parseItems(body.items);
    if (!items.length) return json(400, { error: "items" }, origin);
    // The list page's own path (it may be renamed); the host is always the requesting origin
    const url = new URL(String(body.origin_url ?? ""));
    if (url.origin !== origin || !PATH.test(url.pathname)) throw new Error("origin_url");
    path = url.pathname;
  } catch { return json(400, { error: "fields" }, origin); }

  // Project and item text are echoed into the visitor's email: no links.
  if ([project, ...items.flatMap((i) => [i.name, ...Object.values(i.labels)])].some(hasLink)) {
    console.log("rejected: link in project or items"); return json(400, { error: "link" }, origin);
  }

  const link = `${origin}${path}?s=${shareParam(project, items)}`;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (!(await underLimit(sb, "selection", email, ip))) { console.log("rejected: rate limit"); return json(429, { error: "limit" }, origin); }
  const { data, error } = await sb.from("selections")
    .insert({ ref: mkRef(), email, project: project || null, items, origin_url: `${origin}${path}` })
    .select("id, ref").single();
  if (error) { console.error(error); return json(500, { error: "store" }, origin); }

  // Insert before mail. Mail failures are logged, never surfaced as a failed send.
  const v = visitorEmail(project, items, link);
  const s = studioEmail(email, project, items, link, data.ref, data.id);
  await Promise.allSettled([send(email, v.subject, v.html, v.text), send(STUDIO_TO, s.subject, s.html, s.text)]);
  return json(200, { ref: data.ref }, origin);
});
