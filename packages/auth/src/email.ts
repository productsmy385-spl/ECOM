/**
 * Optional transactional email (Resend REST API). The store does not use an
 * email provider (OPEN_QUESTIONS #21): sign-in and staff-invite emails are
 * Clerk's, and customers follow orders on the order page. Without
 * RESEND_API_KEY messages are skipped (a short info line is logged).
 * Order emails are sent by services/src/notifications.ts after commits.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") console.info(`[email] skipped (no provider): "${msg.subject}"`);
    else console.info(`[email:dev] to=${msg.to} subject="${msg.subject}"\n${msg.text ?? msg.html}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "no-reply@example.com",
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    }),
  });
  if (!res.ok) {
    // Never log the API key; body contains only Resend's error message.
    throw new Error(`[email] Resend responded ${res.status}: ${await res.text()}`);
  }
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function simpleEmail(title: string, body: string, cta?: { label: string; url: string }) {
  const brand = esc(process.env.NEXT_PUBLIC_BRAND_NAME ?? "Store");
  const button = cta
    ? `<p><a href="${esc(cta.url)}" style="display:inline-block;background:#CF0F47;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${esc(cta.label)}</a></p>`
    : "";
  return {
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#000"><h2 style="color:#CF0F47">${brand}</h2><h3>${esc(title)}</h3>${body.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join("")}${button}</div>`,
    text: `${title}\n\n${body}${cta ? `\n\n${cta.label}: ${cta.url}` : ""}`,
  };
}
