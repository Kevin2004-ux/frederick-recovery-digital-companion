import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.MAIL_FROM;

const resend = apiKey ? new Resend(apiKey) : null;

export async function sendVerificationEmail(params: {
  to: string;
  code: string;
  expiresMinutes: number;
}) {
  const to = params.to.trim().toLowerCase();

  // Safe dev fallback: if Resend isn’t configured, log instead of failing signup.
  if (!resend || !from) {
    console.log(
      `[FRDC] (mailer not configured) Verification code for ${to}: ${params.code} (expires in ${params.expiresMinutes}m)`
    );
    return;
  }

  const subject = "Your Frederick Recovery verification code";

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; line-height: 1.4;">
      <h2 style="margin: 0 0 12px;">Verify your email</h2>
      <p style="margin: 0 0 12px;">Your code is:</p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 2px; margin: 8px 0 16px;">
        ${params.code}
      </div>
      <p style="margin: 0;">This code expires in ${params.expiresMinutes} minutes.</p>
      <p style="color: #6b7280; margin-top: 16px;">
        If you didn’t request this, you can ignore this email.
      </p>
    </div>
  `;

  await resend.emails.send({
    from,
    to,
    subject,
    html,
  });
}
