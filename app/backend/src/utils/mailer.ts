// backend/src/utils/mailer.ts
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY?.trim();
const from = process.env.MAIL_FROM?.trim(); 

// Helper: check if we are in a secure dev environment
const isDev = process.env.NODE_ENV === "development";

const resend = apiKey ? new Resend(apiKey) : null;

function getDefaultAppUrl(): string {
  const configuredOrigins = (process.env.FRONTEND_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins[0] ?? "http://localhost:5173";
}

export async function sendVerificationEmail(params: {
  to: string;
  code: string;
  expiresMinutes: number;
}) {
  const to = params.to.trim().toLowerCase();
  const subject = "Your Frederick Recovery verification code";
  
  const html = `
    <div style="font-family: sans-serif; line-height: 1.4;">
      <h2>Verify your email</h2>
      <p>Your code is: <strong>${params.code}</strong></p>
      <p>Expires in ${params.expiresMinutes} minutes.</p>
    </div>
  `;

  // 1. SAFETY CHECK: Missing Config
  if (!resend || !from) {
    // 🚨 MODIFIED FOR TESTING: Always log the code to Render console so the UI can be tested
    console.log(`\n=================================================`);
    console.log(`[FRDC-TESTING] Mailer bypassed.`);
    console.log(`[FRDC-TESTING] VERIFICATION CODE FOR ${to}: ${params.code}`);
    console.log(`=================================================\n`);
    return;
  }

  try {
    const { data, error } = await resend.emails.send({ from, to, subject, html });

    if (error) {
      console.error("[FRDC] Resend API Error"); // Do not log 'error' object if it contains PII
      return;
    }

    // PRODUCTION SAFE: Log ID only
    console.log(`[FRDC] Verification email sent. ID: ${data?.id}`);
  } catch (err) {
    console.error("[FRDC] Mailer Exception");
  }
}

export async function sendPasswordResetEmail(params: { to: string; token: string }) {
  const to = params.to.trim().toLowerCase();
  const resetLink = `http://localhost:5173/reset-password?token=${params.token}`;

  if (!resend || !from) {
    // 🚨 MODIFIED FOR TESTING: Always log the link to Render console
    console.log(`\n=================================================`);
    console.log(`[FRDC-TESTING] Mailer bypassed.`);
    console.log(`[FRDC-TESTING] Reset Link for ${to}: ${resetLink}`);
    console.log(`=================================================\n`);
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      subject: "Reset your password",
      html: `<a href="${resetLink}">Reset Password</a>`
    });

    if (error) {
      console.error("[FRDC] Resend API Error (Reset Flow)");
      return;
    }
    
    console.log(`[FRDC] Password reset email sent.`);
  } catch (err) {
    console.error("[FRDC] Mailer Exception");
  }
}

export async function sendDailyCheckInReminderEmail(params: {
  to: string;
  appUrl?: string;
}) {
  const to = params.to.trim().toLowerCase();
  const appUrl = params.appUrl?.trim() || getDefaultAppUrl();
  const subject = "Frederick Recovery: complete today's check-in";
  const html = `
    <div style="font-family: sans-serif; line-height: 1.5;">
      <h2>Today's symptom check-in</h2>
      <p>Please sign in to Frederick Recovery and complete today's symptom check-in.</p>
      <p><a href="${appUrl}">Open Frederick Recovery</a></p>
    </div>
  `;

  if (!resend || !from) {
    console.log(`\n=================================================`);
    console.log(`[FRDC-TESTING] Mailer bypassed.`);
    console.log(`[FRDC-TESTING] DAILY CHECK-IN REMINDER FOR ${to}: ${appUrl}`);
    console.log(`=================================================\n`);
    return { ok: true, providerMessageId: null };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("[FRDC] Resend API Error (Daily Reminder)");
      return { ok: false, providerMessageId: null };
    }

    console.log(`[FRDC] Daily reminder email sent. ID: ${data?.id}`);
    return { ok: true, providerMessageId: data?.id ?? null };
  } catch (err) {
    console.error("[FRDC] Mailer Exception (Daily Reminder)");
    return { ok: false, providerMessageId: null };
  }
}
