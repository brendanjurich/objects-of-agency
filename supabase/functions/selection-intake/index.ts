// selection-intake — "Email me this list" on /saved-items.
// Browser → fetch → here → insert selections row → two Resend emails → { ref }.
// The guard chain and its order are _shared/intake.ts; the fields and mail are selection.ts.
// Secrets: RESEND_API_KEY, TURNSTILE_SECRET (shared with brief-intake).

import { createClient } from "npm:@supabase/supabase-js@2";
import { turnstile, underLimit } from "../_shared/guard.ts";
import { intake } from "../_shared/intake.ts";
import { send } from "../_shared/mail.ts";
import { createShare } from "../_shared/share.ts";
import { selection } from "./selection.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(intake(selection({
  async insert(row) {
    const { data, error } = await sb.from("selections").insert(row).select("id, ref").single();
    if (error) throw error;
    return data;
  },
  share: (project, items) => createShare(sb, project, items),
}), {
  turnstile,
  underLimit: (name, email, ip) => underLimit(sb, name, email, ip),
  send,
  now: Date.now,
}));
