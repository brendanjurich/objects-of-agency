// "Email me this list" — its definition for the intake chain (_shared/intake.ts): the fields,
// the share link, the selections row and the two emails. The emailed link is a short ?l= link
// to the validated items, stored here (shares), never taken from the browser, and carries no
// price (W07). No Deno or npm: imports at load; the database comes in from index.ts.

import { describe, type Item, parseItems } from "../_shared/items.ts";
import { emailOk, type Definition, Reject, type Stored } from "../_shared/intake.ts";
import { esc, type Mail, STUDIO_TO } from "../_shared/mail.ts";

const PATH = /^\/[a-z0-9\/-]{1,80}$/;

type Row = { email: string; project: string; items: Item[]; path: string; origin: string };

function visitorEmail(project: string, items: Item[], link: string): Omit<Mail, "to"> {
  const title = project ? `Your saved pieces — ${project}` : "Your saved pieces";
  const lines = items.map(describe);
  const html = `<p>Here's the list you saved at objects.agency, so it's with you wherever you are.</p>
<h3>${esc(title)}</h3>
<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
<p><a href="${esc(link)}">Open the list</a> — from there you can add it to your saved items on any device, share it, or start a brief.</p>
<p>Indicative prices are on the site; they aren't included here.</p>
<p>Kind regards,<br>Brendan Jurich<br>Objects of Agency · Perth</p>
<p style="font-size:12px;color:#888">You're receiving this because you asked for it at objects.agency. We keep saved lists for twelve months. <a href="https://objects.agency/privacy">Privacy</a></p>`;
  const text = `Here's the list you saved at objects.agency.\n\n${title}\n${lines.map((l) => `- ${l}`).join("\n")}\n\nOpen the list: ${link}\n\nIndicative prices are on the site; they aren't included here.\n\nKind regards,\nBrendan Jurich\nObjects of Agency · Perth`;
  return { subject: title, html, text };
}

function studioEmail(email: string, project: string, items: Item[], link: string, ref: string, id: string): Omit<Mail, "to"> {
  const text = [`Email: ${email}`, `Project: ${project}`, ...items.map((i) => `Piece: ${describe(i)}`), `List: ${link}`].join("\n") + `\n\nrow: ${id}`;
  return { subject: `Saved list ${ref} · ${items.length} piece${items.length === 1 ? "" : "s"}`, html: `<pre>${esc(text)}</pre>`, text };
}

export function selection(db: {
  insert(row: Record<string, unknown>): Promise<Stored>;
  share(project: string, items: Item[]): Promise<string>;
}): Definition<Row, Stored & { link: string }> {
  return {
    name: "selection",
    refPrefix: "SL",
    parse(body, origin) {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      if (!emailOk(email)) throw new Reject("email");
      const project = typeof body.project === "string" ? body.project.trim().slice(0, 120) : "";
      if (/[\r\n]/.test(project)) throw new Error("project");
      const items = parseItems(body.items);
      if (!items.length) throw new Reject("items");
      // The list page's own path (it may be renamed); the host is always the requesting origin
      const url = new URL(String(body.origin_url ?? ""));
      if (url.origin !== origin || !PATH.test(url.pathname)) throw new Error("origin_url");
      return { email, project, items, path: url.pathname, origin };
    },
    echoed: (row) => [row.project, ...row.items.flatMap((i) => [i.name, ...Object.values(i.labels)])],
    email: (row) => row.email,
    async store(row, ref) {
      const link = `${row.origin}${row.path}?l=${await db.share(row.project, row.items)}`;
      const stored = await db.insert({ ref, email: row.email, project: row.project || null, items: row.items, origin_url: `${row.origin}${row.path}` });
      return { ...stored, link };
    },
    mail: (row, { id, ref, link }) => [
      { to: row.email, ...visitorEmail(row.project, row.items, link) },
      { to: STUDIO_TO, ...studioEmail(row.email, row.project, row.items, link, ref, id) },
    ],
  };
}
