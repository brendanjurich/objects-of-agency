// brief-intake — wayfinder B06.
// Browser → fetch → here → insert briefs row → two Resend emails → { ref }.
// Order matters: CORS → honeypot/min-time → Turnstile → validate → insert → mail.
// Secrets (supabase secrets set): RESEND_API_KEY, TURNSTILE_SECRET. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are injected by the platform.

import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINS = new Set([
  "https://objects.agency",
  "https://www.objects.agency",
  "https://oa-v5.webflow.io",
]);
const STUDIO_TO = "hello@objects.agency";
const FROM = "Objects of Agency <hello@objects.agency>";
const RESPONSE = Deno.env.get("BRIEF_RESPONSE_PROMISE") ?? "two working days";
const MIN_SECONDS = 4;

const ENUM = {
  audience: ["client", "home", "venue", "looking"],
  after: ["seen", "bespoke", "unsure"],
  bespoke: ["table", "seating", "storage", "bedroom", "joinery", "other"],
  setting: ["dining", "living", "bedroom", "study", "outdoor", "res-other", "health", "hospitality", "workplace", "retail", "multi-res", "mixed-use", "education-science", "cultural", "com-other"],
  quantity: ["one", "few", "ten-plus"],
  timing: ["none", "this-year", "six-months", "date"],
  budget: ["firm", "room", "not-yet", "discuss"],
  materials: ["timber", "stone", "metal", "laminate", "open"],
  interest: ["viewfinder", "vesper", "terroir", "locus", "edition", "cabinetry", "none"],
} as const;

const LABEL: Record<string, Record<string, string>> = {
  audience: { client: "Specifying for a client", home: "For their own home", venue: "For a venue or workplace", looking: "Just looking" },
  after: { seen: "A piece they've seen", bespoke: "Something bespoke", unsure: "Not sure yet" },
  bespoke: { table: "A table", seating: "Seating", storage: "Storage or cabinetry", bedroom: "Bed or bedroom", joinery: "Joinery for a whole room", other: "Something else" },
  setting: { dining: "Dining", living: "Living", bedroom: "Bedroom", study: "Study", outdoor: "Outdoor", "res-other": "Residential, other", health: "Health", hospitality: "Hospitality", workplace: "Workplace", retail: "Retail", "multi-res": "Multi-Res", "mixed-use": "Mixed Use", "education-science": "Education & Science", cultural: "Cultural", "com-other": "Commercial, other" },
  quantity: { one: "One piece", few: "A few", "ten-plus": "Ten or more" },
  timing: { none: "No date yet", "this-year": "This year", "six-months": "Within six months", date: "By a date" },
  budget: { firm: "Set, and firm", room: "Set, with some room", "not-yet": "Not yet", discuss: "Prefer to discuss" },
  materials: { timber: "Timber", stone: "Stone", metal: "Metal", laminate: "Laminate", open: "Still deciding" },
  interest: { viewfinder: "ViewFinder", vesper: "Vesper", terroir: "Terroir", locus: "Locus", edition: "Edition pieces", cabinetry: "Custom cabinetry", none: "Nothing for now" },
};

type Body = Record<string, unknown>;

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Vary": "Origin",
});
const json = (status: number, body: unknown, origin: string) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors(origin) } });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const short = (v: unknown, max = 200): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  if (/[\r\n]/.test(t)) throw new Error("newline in short field"); // S4
  return t.slice(0, max);
};
const long = (v: unknown, max = 2000): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const one = <K extends keyof typeof ENUM>(k: K, v: unknown) => (typeof v === "string" && (ENUM[k] as readonly string[]).includes(v) ? v : null);
const many = <K extends keyof typeof ENUM>(k: K, v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && (ENUM[k] as readonly string[]).includes(x)) : []);
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
const mkRef = () => "OA-" + crypto.getRandomValues(new Uint8Array(3)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "").toUpperCase();

async function turnstile(token: string, ip: string | null) {
  const secret = Deno.env.get("TURNSTILE_SECRET");
  if (!secret) return true; // not configured yet — allow, so staging can run before B04 finishes
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret, response: token, remoteip: ip ?? undefined }),
  });
  const j = await r.json();
  return j.success === true;
}

async function send(to: string, subject: string, html: string, text: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) { console.warn("RESEND_API_KEY unset; skipping mail to", to); return; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html, text }),
  });
  if (!r.ok) console.error("resend", r.status, await r.text());
}

function rows(b: Record<string, unknown>) {
  const out: [string, string][] = [];
  const add = (k: string, v: string | null | undefined) => { if (v) out.push([k, v]); };
  const lab = (k: keyof typeof LABEL, v: unknown) => Array.isArray(v) ? v.map((x) => LABEL[k][x as string]).join(", ") : (v ? LABEL[k][v as string] : null);
  add("For", lab("audience", b.audience));
  add("After", lab("after", b.after));
  add("Pieces", (b.pieces as string[]).join(", "));
  add("Bespoke", lab("bespoke", b.bespoke));
  add("Setting", lab("setting", b.setting));
  add("How many", lab("quantity", b.quantity));
  add("When", b.timing === "date" && b.timing_date ? `By ${b.timing_date}` : lab("timing", b.timing));
  add("Budget", lab("budget", b.budget_band));
  add("Materials", lab("materials", b.materials));
  add("Note", b.note as string | null);
  add("Interested in", lab("interest", b.interest));
  return out;
}

function ackEmail(b: Record<string, unknown>, ref: string) {
  const first = ((b.name as string | null) ?? "").split(" ")[0] || "Hello";
  const next: Record<string, string> = {
    client: `We'll come back within ${RESPONSE} with first thoughts, a couple of questions if we have them, and a time to talk.`,
    home: `We'll come back within ${RESPONSE}. Commissions with us run in three short stages — a conversation about the piece, a drawing and a price, then making. There's no obligation at any stage before the second.`,
    venue: `We'll come back within ${RESPONSE} with first thoughts and a time to talk. For quantities, we'll ask about the programme early so the making fits it.`,
  };
  const r = rows(b);
  const html = `<p>${esc(first)},</p>
<p>Thanks for this. Here's your brief as you gave it to us, written up so it's useful to you whether or not we go further together.</p>
<h3>Project brief · ${esc(ref)}</h3>
<table cellpadding="4">${r.map(([k, v]) => `<tr><td style="color:#666">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
<p>${esc(next[b.audience as string])}</p>
<p>Brendan Jurich<br>Objects of Agency · Perth</p>
<p style="font-size:12px;color:#888">You're receiving this because you sent a brief at objects.agency. We keep briefs for twelve months. <a href="https://objects.agency/privacy">Privacy</a></p>`;
  const text = `${first},\n\nThanks for this. Here's your brief as you gave it to us.\n\nProject brief · ${ref}\n${r.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${next[b.audience as string]}\n\nBrendan Jurich\nObjects of Agency · Perth`;
  return { subject: `Your brief — ${ref}`, html, text };
}

function lookingEmail(b: Record<string, unknown>) {
  const list = (b.interest as string[]).filter((x) => x !== "none").map((x) => LABEL.interest[x]).join(", ");
  const text = `Hello,\n\nThanks for looking. We'll send a note when something new leaves the workshop — rarely${list ? `, and about ${list}` : ""}. Nothing else.\n\nBrendan`;
  return { subject: "Noted — Objects of Agency", html: `<p>${esc(text).replace(/\n/g, "<br>")}</p>`, text };
}

function studioEmail(b: Record<string, unknown>, ref: string, id: string) {
  const r = rows(b).concat([["Name", (b.name as string) ?? ""], ["Email", (b.email as string) ?? ""], ["Practice", (b.practice as string) ?? ""], ["Referrer", (b.referrer as string) ?? ""], ["Origin", (b.origin_url as string) ?? ""]]);
  const text = r.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\nrow: ${id}`;
  return { subject: `Brief ${ref} · ${b.audience} · ${(b.after as string[])[0] ?? ""}`, html: `<pre>${esc(text)}</pre>`, text };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (!ORIGINS.has(origin)) return new Response("forbidden", { status: 403 }); // S6
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json(405, { error: "method" }, origin);

  let body: Body;
  try { body = await req.json(); } catch { return json(400, { error: "json" }, origin); }

  // S3: honeypot + minimum time on page
  if (typeof body.website === "string" && body.website) return json(200, { ref: mkRef() }, origin); // silent
  const started = Number(body.started_at);
  if (!started || Date.now() - started < MIN_SECONDS * 1000) return json(200, { ref: mkRef() }, origin);
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for");
  if (!(await turnstile(String(body.turnstile ?? ""), ip))) return json(403, { error: "verification" }, origin);

  let row: Record<string, unknown>;
  try {
    const audience = one("audience", body.audience);
    if (!audience) return json(400, { error: "audience" }, origin);
    const email = short(body.email, 254);
    if (audience !== "looking" && (!email || !emailOk(email))) return json(400, { error: "email" }, origin);
    if (email && !emailOk(email)) return json(400, { error: "email" }, origin);
    row = {
      ref: mkRef(),
      audience,
      after: many("after", body.after),
      pieces: Array.isArray(body.pieces) ? body.pieces.map((p) => short(p, 120)).filter(Boolean).slice(0, 12) : [],
      bespoke: many("bespoke", body.bespoke),
      setting: many("setting", body.setting),
      quantity: one("quantity", body.quantity),
      timing: one("timing", body.timing),
      timing_date: typeof body.timing_date === "string" && /^\d{4}-\d{2}$/.test(body.timing_date) ? body.timing_date + "-01" : null,
      budget_band: one("budget", body.budget),
      materials: many("materials", body.materials),
      interest: many("interest", body.interest),
      note: long(body.note),
      name: short(body.name, 120),
      email,
      practice: short(body.practice, 160),
      referrer: short(body.referrer, 500),
      origin_url: short(body.origin_url, 500),
    };
  } catch { return json(400, { error: "fields" }, origin); }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb.from("briefs").insert(row).select("id, ref").single();
  if (error) { console.error(error); return json(500, { error: "store" }, origin); }

  // Insert before mail. Mail failures are logged, never surfaced as a failed brief.
  const studio = studioEmail(row, data.ref, data.id);
  const tasks = [send(STUDIO_TO, studio.subject, studio.html, studio.text)];
  if (row.email) {
    const m = row.audience === "looking" ? lookingEmail(row) : ackEmail(row, data.ref);
    tasks.push(send(row.email as string, m.subject, m.html, m.text));
  }
  await Promise.allSettled(tasks);
  return json(200, { ref: data.ref }, origin);
});
