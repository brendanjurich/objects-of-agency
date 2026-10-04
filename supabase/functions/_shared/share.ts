// Short share links for /saved-items (?l=<id>), used by share-list and selection-intake.
// The id is the project name as a slug plus a random suffix ("smith-residence-k3f9x2"), or
// ten random characters with no project. The suffix keeps a guessed project name from
// opening someone's list. Sharing the same list again returns the same id.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { Item } from "./items.ts";

export const ID = /^[a-z0-9-]{6,60}$/;
const ABC = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o, 1/l: read aloud or retyped

function random(n: number) {
  return [...crypto.getRandomValues(new Uint8Array(n))].map((b) => ABC[b % ABC.length]).join("");
}

// "Smith Résidence — Level 2" → "smith-residence-level-2", cut at a word, max 40
function slugify(s: string) {
  const slug = s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length <= 40 ? slug : slug.slice(0, 40).replace(/-[^-]*$/, "") || slug.slice(0, 40);
}

async function sha256(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// { id } for a list already stored (its retention clock restarts), or null
export async function existing(sb: SupabaseClient, project: string, items: Item[]) {
  const hash = await sha256(JSON.stringify([project, items]));
  const { data } = await sb.from("shares").update({ touched_at: new Date().toISOString() })
    .eq("hash", hash).select("id").maybeSingle();
  return { hash, id: (data?.id as string | undefined) ?? null };
}

// Store a list and return its id. Retries on the rare id clash; a hash clash means the same
// list was stored a moment ago by another request, so that id is returned.
export async function createShare(sb: SupabaseClient, project: string, items: Item[]): Promise<string> {
  const found = await existing(sb, project, items);
  if (found.id) return found.id;
  const stem = slugify(project);
  for (let i = 0; i < 4; i++) {
    const id = stem ? `${stem}-${random(6)}` : random(10);
    const { error } = await sb.from("shares").insert({ id, hash: found.hash, project: project || null, items });
    if (!error) return id;
    if (error.code !== "23505") throw error;
    const again = await existing(sb, project, items);
    if (again.id) return again.id;
  }
  throw new Error("share id");
}
