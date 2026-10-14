// brief-intake — wayfinder B06.
// Browser → fetch → here → insert briefs row → two Resend emails → { ref }.
// The guard chain and its order are _shared/intake.ts; the brief's fields and mail are brief.ts.
// Secrets (supabase secrets set): RESEND_API_KEY, TURNSTILE_SECRET. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are injected by the platform.

import { createClient } from "npm:@supabase/supabase-js@2";
import { turnstile, underLimit } from "../_shared/guard.ts";
import { intake } from "../_shared/intake.ts";
import { send } from "../_shared/mail.ts";
import { brief } from "./brief.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(intake(brief({
  async insert(row) {
    const { data, error } = await sb.from("briefs").insert(row).select("id, ref").single();
    if (error) throw error;
    return data;
  },
}), {
  turnstile,
  underLimit: (name, email, ip) => underLimit(sb, name, email, ip),
  send,
  now: Date.now,
}));
