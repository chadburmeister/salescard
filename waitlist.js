// /api/waitlist — Vercel serverless function
// Accepts { email, role } from the landing-page modal.
// Sends a welcome email to the visitor and a notification email to the founder
// via the Resend API. Requires the env var RESEND_API_KEY to be set in the
// Vercel project that hosts this function (the salescard landing project).

const FOUNDER_EMAIL = "chadburmeister@gmail.com";
const FROM_ADDRESS  = "SalesCard <hello@salescard.ai>";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, role } = (req.body || {});
  if (!email || typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "Please provide a valid email." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[waitlist] RESEND_API_KEY not configured");
    return res.status(500).json({ error: "Server misconfigured. Please try again later." });
  }

  const roleClean = (typeof role === "string" ? role.trim() : "").slice(0, 80);
  const emailClean = email.trim().toLowerCase().slice(0, 200);

  // Send welcome email to the visitor (and notification to founder, both via Resend)
  try {
    // 1. Welcome email
    const welcomeBody = welcomeHtml({ email: emailClean, role: roleClean });
    const welcomeRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: emailClean,
        subject: "You're on the SalesCard waitlist",
        html: welcomeBody,
        text: welcomeText({ email: emailClean, role: roleClean }),
      }),
    });
    if (!welcomeRes.ok) {
      const body = await welcomeRes.text().catch(() => "");
      console.error("[waitlist] Welcome email failed:", welcomeRes.status, body);
      // Don't fail the user-facing request — we still log the signup via the
      // founder-notification email below.
    }

    // 2. Founder notification
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: FOUNDER_EMAIL,
        reply_to: emailClean,
        subject: `New waitlist signup: ${emailClean}${roleClean ? ` (${roleClean})` : ""}`,
        text:
          `New SalesCard waitlist signup.\n\n` +
          `Email: ${emailClean}\n` +
          `Role:  ${roleClean || "(not provided)"}\n` +
          `When:  ${new Date().toISOString()}\n` +
          `Referrer: ${req.headers["referer"] || "(none)"}\n` +
          `UA:    ${req.headers["user-agent"] || "(none)"}\n`,
      }),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[waitlist] Resend call threw:", err);
    return res.status(500).json({ error: "Couldn't reach our email service. Try again in a minute." });
  }
}

function welcomeText({ email, role }) {
  return (
    `Hey,\n\n` +
    `You're on the SalesCard waitlist.\n\n` +
    `We're standing up the first cohort of reps with verified cards. We'll send you the signup link the moment your slot opens.\n\n` +
    `If you're one of the first 100, you get a permanent FOUNDING MEMBER badge on your card.\n\n` +
    `In the meantime:\n` +
    `- See the full product preview: https://salescard.ai\n` +
    `- Reply to this email if you have questions\n` +
    `- Forward this to a sales rep who'd want in\n\n` +
    `Talk soon,\n` +
    `Chad\n` +
    `SalesCard\n`
  );
}

function welcomeHtml({ email, role }) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
<div style="max-width:560px;margin:32px auto;background:white;border-radius:16px;padding:36px 32px;">
  <div style="margin-bottom:24px;">
    <span style="font-weight:900;font-size:22px;letter-spacing:-0.02em;">
      <span style="color:#3478C0;">Sales</span><span style="color:#10B981;">Card</span>
    </span>
  </div>
  <h1 style="font-size:24px;line-height:1.2;letter-spacing:-0.02em;font-weight:900;margin:0 0 12px;">You're on the list.</h1>
  <p style="font-size:15.5px;line-height:1.55;color:#374151;margin:0 0 16px;">
    We're standing up the first cohort of reps with verified cards. We'll send you the signup link the moment your slot opens.
  </p>
  <div style="background:linear-gradient(90deg,#fff7e0,#fef3c7);border:1px solid #fcd34d;border-radius:12px;padding:16px 18px;margin:20px 0;">
    <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#C98E18;margin-bottom:6px;">Founding 100 perk</div>
    <div style="font-size:14.5px;color:#111827;">
      If you're one of the first 100 reps to sign up, you get a permanent
      <strong>FOUNDING MEMBER</strong> badge on your SalesCard. It travels with you forever.
    </div>
  </div>
  <p style="font-size:15.5px;line-height:1.55;color:#374151;margin:16px 0;">
    In the meantime: <a href="https://salescard.ai" style="color:#3478C0;">see the full product preview</a>,
    reply to this email with questions, or forward it to a rep who'd want in.
  </p>
  <p style="font-size:15.5px;color:#374151;margin:24px 0 0;">
    Talk soon,<br>
    <strong>Chad</strong><br>
    SalesCard
  </p>
  <hr style="border:0;border-top:1px solid #e5e7eb;margin:32px 0;">
  <p style="font-size:12px;color:#9ca3af;margin:0;">
    You're receiving this because you signed up at <a href="https://salescard.ai" style="color:#9ca3af;">salescard.ai</a>. Reply &quot;unsubscribe&quot; to stop.
  </p>
</div>
</body></html>`;
}
