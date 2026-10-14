// Origin allowlist and JSON responses for every browser-facing function (brief-intake,
// selection-intake, share-list). Adding the live domain is one edit here.

export const ORIGINS = new Set([
  "https://objects.agency",
  "https://www.objects.agency",
  "https://oa-v5.webflow.io",
]);

export const cors = (origin: string, methods = "POST, OPTIONS") => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": methods,
  "Access-Control-Allow-Headers": "content-type",
  "Vary": "Origin",
});

export const json = (status: number, body: unknown, origin: string, methods?: string) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors(origin, methods) } });
