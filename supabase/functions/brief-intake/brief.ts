// The project brief's definition for the intake chain (_shared/intake.ts): its fields, the
// text echoed into mail, the briefs row and the three emails. No Deno or npm: imports at
// load, so tests/ runs it in Node; the briefs insert comes in from index.ts.

import { describe, type Item, parseItems } from "../_shared/items.ts";
import { hasLink } from "../_shared/guard.ts";
import { emailOk, type Definition, Reject, type Stored } from "../_shared/intake.ts";
import { esc, type Mail, STUDIO_TO } from "../_shared/mail.ts";

// Read when a mail is written, not at import (Node has no Deno global)
const response = () => (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get("BRIEF_RESPONSE_PROMISE") ?? "two working days";

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

type Row = Record<string, unknown>;

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

// The stored "2027-02-01" → "February 2027", matching the on-page summary.
function monthName(v: string) {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(v);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" }) : v;
}

function rows(b: Record<string, unknown>) {
  const out: [string, string][] = [];
  const add = (k: string, v: string | null | undefined) => { if (v) out.push([k, v]); };
  const lab = (k: keyof typeof LABEL, v: unknown) => Array.isArray(v) ? v.map((x) => LABEL[k][x as string]).join(", ") : (v ? LABEL[k][v as string] : null);
  add("Project", b.project as string | null);
  add("For", lab("audience", b.audience));
  add("After", lab("after", b.after));
  add("Pieces", (b.pieces as string[]).join(", "));
  (b.items as Item[]).forEach((i) => add("Configuration", describe(i)));
  add("Bespoke", lab("bespoke", b.bespoke));
  add("Setting", lab("setting", b.setting));
  add("How many", lab("quantity", b.quantity));
  add("When", b.timing === "date" && b.timing_date ? `By ${monthName(b.timing_date as string)}` : lab("timing", b.timing));
  add("Budget", lab("budget", b.budget_band));
  add("Materials", lab("materials", b.materials));
  add("Note", b.note as string | null);
  add("Interested in", lab("interest", b.interest));
  return out;
}

function ackEmail(b: Row, ref: string): Omit<Mail, "to"> {
  const first = ((b.name as string | null) ?? "").split(" ")[0] || "Hello";
  const RESPONSE = response();
  const next: Record<string, string> = {
    client: `We'll come back within ${RESPONSE} with first thoughts, a couple of questions if we have them, and a time to talk.`,
    home: `We'll come back within ${RESPONSE}. Commissions with us run in three short stages:\n1. A conversation about the piece and a site measure if required.\n2. Design and construction drawings with pricing.\n3. Manufacture.\nNothing is binding until you've seen the price and chosen to go ahead.`,
    venue: `We'll come back within ${RESPONSE} with first thoughts and a time to talk. For quantities, we'll ask about the programme early so the making fits it.`,
  };
  // A note with a link reaches the studio in full but is never echoed to the visitor's inbox.
  const r = rows(hasLink(b.note as string | null) ? { ...b, note: "Received. Links aren't repeated in this email." } : b);
  const html = `<p>${esc(first)},</p>
<p>Thanks for this. Here's your brief as you gave it to us, written up so it's useful to you whether or not we go further together.</p>
<h3>Project brief · ${esc(ref)}</h3>
<table cellpadding="4">${r.map(([k, v]) => `<tr><td style="color:#666">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
<p>${esc(next[b.audience as string]).replace(/\n/g, "<br>")}</p>
<p>Kind regards,<br>Brendan Jurich<br>Objects of Agency · Perth</p>
<p style="font-size:12px;color:#888">You're receiving this because you sent a brief at objects.agency. We keep briefs for twelve months. <a href="https://objects.agency/privacy">Privacy</a></p>`;
  const text = `${first},\n\nThanks for this. Here's your brief as you gave it to us.\n\nProject brief · ${ref}\n${r.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${next[b.audience as string]}\n\nKind regards,\nBrendan Jurich\nObjects of Agency · Perth`;
  return { subject: `Your brief — ${ref}`, html, text };
}

function lookingEmail(b: Row): Omit<Mail, "to"> {
  const list = (b.interest as string[]).filter((x) => x !== "none").map((x) => LABEL.interest[x]).join(", ");
  const text = `Hello,\n\nThanks for looking. We'll send a note when something new leaves the workshop — rarely${list ? `, and about ${list}` : ""}. Nothing else.\n\nKind regards,\nBrendan Jurich\nObjects of Agency · Perth`;
  return { subject: "Noted — Objects of Agency", html: `<p>${esc(text).replace(/\n/g, "<br>")}</p>`, text };
}

function studioEmail(b: Row, ref: string, id: string): Omit<Mail, "to"> {
  const r = rows(b).concat([["Name", (b.name as string) ?? ""], ["Email", (b.email as string) ?? ""], ["Practice", (b.practice as string) ?? ""], ["Referrer", (b.referrer as string) ?? ""], ["Origin", (b.origin_url as string) ?? ""]]);
  const text = r.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\nrow: ${id}`;
  return { subject: `Brief ${ref} · ${b.audience} · ${(b.after as string[])[0] ?? ""}`, html: `<pre>${esc(text)}</pre>`, text };
}

export function brief(db: { insert(row: Row): Promise<Stored> }): Definition<Row> {
  return {
    name: "brief",
    refPrefix: "OA",
    parse(body) {
      const audience = one("audience", body.audience);
      if (!audience) throw new Reject("audience");
      const email = short(body.email, 254);
      if (audience !== "looking" && (!email || !emailOk(email))) throw new Reject("email");
      if (email && !emailOk(email)) throw new Reject("email");
      return {
        audience,
        after: many("after", body.after),
        pieces: Array.isArray(body.pieces) ? body.pieces.map((p) => short(p, 120)).filter(Boolean).slice(0, 12) : [],
        items: parseItems(body.items),
        project: short(body.project, 120),
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
    },
    // The note is kept for the studio in full and left out of the visitor's copy (ackEmail)
    echoed: (row) => [row.name as string | null, row.project as string | null, ...(row.pieces as string[]),
      ...(row.items as Item[]).flatMap((i) => [i.name, ...Object.values(i.labels)])],
    email: (row) => row.email as string | null,
    store: (row, ref) => db.insert({ ...row, ref }),
    mail(row, { id, ref }) {
      const out: Mail[] = [{ to: STUDIO_TO, ...studioEmail(row, ref, id) }];
      if (row.email) out.push({ to: row.email as string, ...(row.audience === "looking" ? lookingEmail(row) : ackEmail(row, ref)) });
      return out;
    },
  };
}
