// Saved configurations from the Saved Items page (oa-saved-items.js), posted as items[] by
// oa-brief.js (brief-intake) and by "Email me this list" (selection-intake). Strict on purpose: an unknown
// key anywhere — a price above all (W07) — rejects the whole brief. No Deno APIs here, so
// Node can test it — import a .mts copy (the repo isn't "type": "module").

export const GROUPS = ["Sizes", "Top-Material", "Timber", "Anodised-Finish"];
const KEYS = ["slug", "name", "options", "labels", "qty"];
const SLUG = /^[a-z0-9-]{1,100}$/;

export type Item = { slug: string; name: string; options: Record<string, string>; labels: Record<string, string>; qty: number };

const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function text(v: unknown, max: number): string {
  if (typeof v !== "string" || /[\r\n]/.test(v) || v.trim().length > max) throw new Error("item text");
  return v.trim();
}

export function parseItems(v: unknown): Item[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > 12) throw new Error("items");
  return v.map((it) => {
    if (!plain(it) || Object.keys(it).some((k) => !KEYS.includes(k))) throw new Error("item keys");
    if (typeof it.slug !== "string" || !SLUG.test(it.slug)) throw new Error("item slug");
    const name = text(it.name, 120);
    if (!name) throw new Error("item name");
    if (!plain(it.options) || (it.labels !== undefined && !plain(it.labels))) throw new Error("item options");
    const options: Record<string, string> = {};
    for (const [k, o] of Object.entries(it.options)) {
      if (!GROUPS.includes(k) || typeof o !== "string" || !SLUG.test(o)) throw new Error("item option");
      options[k] = o;
    }
    const labels: Record<string, string> = {};
    for (const [k, l] of Object.entries(it.labels ?? {})) {
      if (!(k in options)) throw new Error("item label");
      const t = text(l, 80);
      if (t) labels[k] = t;
    }
    const qty = it.qty ?? 1;
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > 99) throw new Error("item qty");
    return { slug: it.slug, name, options, labels, qty };
  });
}

// "ViewFinder CR — 700mm Diameter · Oak ×2", for the emails.
export function describe(i: Item): string {
  const config = GROUPS.filter((g) => i.labels[g]).map((g) => i.labels[g]).join(" · ");
  return (config ? `${i.name} — ${config}` : i.name) + (i.qty > 1 ? ` ×${i.qty}` : "");
}

// A stored list as the /saved-items page reads it — the same shape as the old ?s= link, so
// parseShare() in oa-saved-items.js reads both. Never a price (W07).
// {v, p, $, i: [[slug, qty, [[group, option, label]]]]}.
export function compact(project: string, items: Item[]) {
  return {
    v: 1,
    p: project,
    $: 0,
    i: items.map((i) => [i.slug, i.qty, Object.keys(i.options).map((k) => [GROUPS.indexOf(k), i.options[k], i.labels[k] ?? ""])]),
  };
}
