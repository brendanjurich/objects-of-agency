// Mail from hello@objects.agency via Resend, for the intake functions. RESEND_API_KEY is read
// at send time, never at import, so Node can load the files that import this (tests/).

export const STUDIO_TO = "hello@objects.agency";
const FROM = "Objects of Agency <hello@objects.agency>";

export type Mail = { to: string; subject: string; html: string; text: string };

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export async function send(m: Mail) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) { console.warn("RESEND_API_KEY unset; skipping mail to", m.to); return; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to: m.to, subject: m.subject, html: m.html, text: m.text, reply_to: STUDIO_TO }),
  });
  if (!r.ok) console.error("resend", r.status, await r.text());
}
