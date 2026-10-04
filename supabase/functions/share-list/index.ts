// share-list — the Share button on /saved-items.
// POST {project, items} → store the list in shares → { id }; the page copies /saved-items?l=<id>.
// GET ?id=<id> → { v, p, $, i } (the compact list oa-saved-items.js reads), or 404.
// No Turnstile: it sends no mail and collects no email. Origin allowlist, the item validator,
// a link check (the text is shown on our page) and the per-IP limit — counted only when a
// new list is stored, since sharing the same list again returns its id. Never a price (W07).

import { createClient } from "npm:@supabase/supabase-js@2";
import { compact, type Item, parseItems } from "../_shared/items.ts";
import { clientIp, hasLink, underLimit } from "../_shared/guard.ts";
import { createShare, existing, ID } from "../_shared/share.ts";

const ORIGINS = new Set([
  "https://objects.agency",
  "https://www.objects.agency",
  "https://oa-v5.webflow.io",
]);

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Vary": "Origin",
});
const json = (status: number, body: unknown, origin: string) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors(origin) } });

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  if (!ORIGINS.has(origin)) return new Response("forbidden", { status: 403 });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (req.method === "GET") {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!ID.test(id)) return json(404, { error: "missing" }, origin);
    const { data, error } = await sb.from("shares").select("project, items").eq("id", id).maybeSingle();
    if (error) { console.error(error); return json(500, { error: "store" }, origin); }
    if (!data) return json(404, { error: "missing" }, origin);
    return json(200, compact(data.project ?? "", data.items as Item[]), origin);
  }
  if (req.method !== "POST") return json(405, { error: "method" }, origin);

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 32_000) return json(413, { error: "size" }, origin);
  let project: string, items: Item[];
  try {
    const body = await req.json();
    project = typeof body.project === "string" ? body.project.trim().slice(0, 120) : "";
    if (/[\r\n]/.test(project)) throw new Error("project");
    items = parseItems(body.items);
    if (!items.length) return json(400, { error: "items" }, origin);
  } catch { return json(400, { error: "fields" }, origin); }

  if ([project, ...items.flatMap((i) => [i.name, ...Object.values(i.labels)])].some(hasLink)) {
    console.log("rejected: link in project or items"); return json(400, { error: "link" }, origin);
  }

  try {
    const found = await existing(sb, project, items);
    if (found.id) return json(200, { id: found.id }, origin);
    if (!(await underLimit(sb, "share", null, clientIp(req)))) { console.log("rejected: rate limit"); return json(429, { error: "limit" }, origin); }
    return json(200, { id: await createShare(sb, project, items) }, origin);
  } catch (e) { console.error(e); return json(500, { error: "store" }, origin); }
});
