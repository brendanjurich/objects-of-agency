// Keep-alive target for the Free-tier pause (B04). Hit by .github/workflows/supabase-keepalive.yml.
Deno.serve(() => new Response("ok", { headers: { "content-type": "text/plain" } }));
