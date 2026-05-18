// /api/recruiter — Vercel serverless function
// Accepts { name, email, company, plan, source } from the recruiter modal on
// /recruiters.html. Sends a tailored welcome email to the recruiter and a
// notification email to the founder via the Resend API. Requires the env var
// RESEND_API_KEY to be set in the Vercel project that hosts this function
// (the salescard landing project, NOT the salescard-app project).

const FOUNDER_EMAIL = "chadburmeister@gmail.com";
const FROM_ADDRESS  = "SalesCard <hello@salescard.ai>";

const PLAN_LABELS = {
  "solo-monthly": "Solo Recruiter — $249 / mo",
  "solo-annual":  "Solo Recruiter — $3,000 / yr (lock the rate)",
  "team":         "Team — $10,000 / yr (5 seats)",
  "enterprise":   "More than 5 seats — talk to us",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, company, plan, source } = (req.body || {});

  if (!email || typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "Please provide a valid email." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[recruiter] RESEND_API_KEY not configured");
    return res.status(500).json({ error: "Server misconfigured. Please try again later." });
  }

  const emailClean   = email.trim().toLowerCase().slice(0, 200);
  const nameClean    = (typeof name    === "string" ? name.trim()    : "").slice(0, 120);
  const companyClean = (typeof company === "string" ? company.trim() : "").slice(0, 160);
  const planRaw      = (typeof plan    === "string" ? plan.trim()    : "");
  const planLabel    = PLAN_LABELS[planRaw] || planRaw || "(not specified)";
  const sourceClean  = (typeof source  === "string" ? source.trim()  : "").slice(0, 80);

  try {
    // 1. Welcome email to the recruiter
    const welcomeRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: emailClean,
        reply_to: FOUNDER_EMAIL,
        subject: "Your SalesCard recruiter seat — next steps",
        html: welcomeHtml({ name: nameClean, planLabel, company: companyClean }),
        text: welcomeText({ name: nameClean, planLabel, company: companyClean }),
      }),
    });
    if (!welcomeRes.ok) {
      const body = await welcomeRes.text().catch(() => "");
      console.error("[recruiter] Welcome email failed:", welcomeRes.status, body);
      // Continue — we still want the founder to know about the signup.
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
        subject: `New RECRUITER signup: ${nameClean || emailClean} — ${planLabel}`,
        text:
          `New SalesCard recruiter signup.\n\n` +
          `Name:    ${nameClean    || "(not provided)"}\n` +
          `Email:   ${emailClean}\n` +
          `Company: ${companyClean || "(not provided)"}\n` +
          `Plan:    ${planLabel}\n` +
          `Source:  ${sourceClean  || "(recruiters page)"}\n` +
          `When:    ${new Date().toISOString()}\n` +
          `Referrer:${req.headers["referer"] || "(none)"}\n` +
          `UA:      ${req.headers["user-agent"] || "(none)"}\n`,
      }),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[recruiter] Resend call threw:", err);
    return res.status(500).json({ error: "Couldn't reach our email service. Try again in a minute." });
  }
}

function welcomeText({ name, planLabel, company }) {
  const hi = name ? `Hey ${name.split(/\s+/)[0]},` : "Hey,";
  return (
    `${hi}\n\n` +
    `Your SalesCard recruiter seat is reserved.\n\n` +
    `Plan: ${planLabel}\n` +
    (company ? `Company: ${company}\n` : "") +
    `\n` +
    `Here's what happens next:\n` +
    `1. We'll be in touch within one business day to set up your seat.\n` +
    `2. Onboarding is one-on-one — we'll import your active pipeline and set up your saved searches.\n` +
    `3. No payment until your seat is fully provisioned and you've placed at least one verified candidate.\n` +
    `\n` +
    `Reminder on the guarantee: if you don't put three verified candidates in front of your clients in the first 60 days, we refund every dollar.\n` +
    `\n` +
    `Reply to this email any time with questions.\n` +
    `\n` +
    `— Chad\n` +
    `SalesCard\n` +
    `https://salescard.ai/recruiters\n`
  );
}

function welcomeHtml({ name, planLabel, company }) {
  const hi = name ? `Hey ${escapeHtml(name.split(/\s+/)[0])},` : "Hey,";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
<div style="max-width:560px;margin:32px auto;background:white;border-radius:16px;padding:36px 32px;">
  <div style="margin-bottom:24px;">
    <span style="font-weight:900;font-size:22px;letter-spacing:-0.02em;">
      <span style="color:#3478C0;">Sales</span><span style="color:#10B981;">Card</span>
    </span>
  </div>
  <h1 style="font-size:24px;line-height:1.2;letter-spacing:-0.02em;font-weight:900;margin:0 0 12px;">Your recruiter seat is reserved.</h1>
  <p style="font-size:15.5px;line-height:1.55;color:#374151;margin:0 0 16px;">
    ${hi} Thanks for reserving a seat among the founding 25 recruiters on SalesCard. Here's the short version of what happens next.
  </p>

  <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:18px 20px;margin:20px 0;">
    <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#6B7280;margin-bottom:8px;">Your reservation</div>
    <table style="width:100%;font-size:14.5px;color:#111827;border-collapse:collapse;">
      <tr><td style="padding:3px 0;color:#6B7280;width:90px;">Plan</td><td style="padding:3px 0;font-weight:700;">${escapeHtml(planLabel)}</td></tr>
      ${company ? `<tr><td style="padding:3px 0;color:#6B7280;">Company</td><td style="padding:3px 0;">${escapeHtml(company)}</td></tr>` : ""}
    </table>
  </div>

  <ol style="font-size:15.5px;line-height:1.55;color:#374151;margin:0 0 20px;padding-left:22px;">
    <li style="margin-bottom:8px;">We&apos;ll be in touch within <strong>one business day</strong> to set up your seat.</li>
    <li style="margin-bottom:8px;">Onboarding is one-on-one — we&apos;ll import your active pipeline and set up your saved searches.</li>
    <li style="margin-bottom:0;">No payment until your seat is fully provisioned and you&apos;ve seen the verified pool in your segment.</li>
  </ol>

  <div style="background:linear-gradient(90deg,rgba(245,183,57,0.10),rgba(245,183,57,0.04));border:1px solid #FCD34D;border-radius:12px;padding:16px 18px;margin:20px 0;">
    <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#C98E18;margin-bottom:6px;">Your guarantee</div>
    <div style="font-size:14px;color:#111827;line-height:1.5;">
      If you don&apos;t put three verified candidates in front of your clients in the first 60 days, we refund every dollar — no questions, no exit calls.
    </div>
  </div>

  <p style="font-size:15.5px;line-height:1.55;color:#374151;margin:16px 0;">
    Reply to this email any time. Looking forward to onboarding you.
  </p>
  <p style="font-size:15.5px;color:#374151;margin:24px 0 0;">
    — <strong>Chad</strong><br>
    SalesCard
  </p>
  <hr style="border:0;border-top:1px solid #e5e7eb;margin:32px 0;">
  <p style="font-size:12px;color:#9ca3af;margin:0;">
    You&apos;re receiving this because you reserved a recruiter seat at <a href="https://salescard.ai/recruiters" style="color:#9ca3af;">salescard.ai/recruiters</a>. Reply &quot;unsubscribe&quot; to stop.
  </p>
</div>
</body></html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
