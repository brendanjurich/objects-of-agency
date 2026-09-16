// Keep-alive target for the Free-tier pause (B04). Hit by .github/workflows/keepalive.yml.
//
// The ping has to touch Postgres, not just return 200. Returning "ok" from the Functions
// runtime proves the runtime is alive and says nothing about the database, which is what
// actually pauses. A head-count against `briefs` is the cheapest query that still opens a
// database connection, and it returns no rows — this endpoint is deployed with JWT
// verification off, so it must never hand back data, only whether the query ran.
//
// Failing loudly is the point: the workflow curls with -f, so a non-200 turns the run red
// instead of leaving a dead keep-alive looking healthy.
import { createClient } from "npm:@supabase/supabase-js@2";

const plain = { "content-type": "text/plain" };

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("ping: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY unset");
    return new Response("no-env", { status: 500, headers: plain });
  }
  const { error } = await createClient(url, key)
    .from("briefs")
    .select("id", { count: "exact", head: true });
  if (error) {
    console.error("ping: db unreachable —", error.message);
    return new Response("db-error", { status: 500, headers: plain });
  }
  return new Response("ok", { headers: plain });
});
