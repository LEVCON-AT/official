import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
import { db } from '@/lib/db';

// SMTP config (shared with contact form)
const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const NEWSLETTER_FROM = process.env.NEWSLETTER_FROM_EMAIL || SMTP_USER || 'news@levcon.ai';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://levcon.ai';

// Rate limiting via in-memory cache (per email, max 5 signups per hour)
const signupAttempts = new Map<string, { count: number; firstAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Token expires after 7 days
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

type SubscribeBody = {
  email?: unknown;
  frequency?: unknown;
  language?: unknown;
  website?: unknown; // honeypot
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isValidFrequency(f: string): f is 'daily' | 'weekly' | 'digest' {
  return f === 'daily' || f === 'weekly' || f === 'digest';
}

function isValidLanguage(l: string): l is 'de' | 'en' {
  return l === 'de' || l === 'en';
}

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = signupAttempts.get(email);

  if (!entry || now - entry.firstAt > RATE_LIMIT_WINDOW_MS) {
    signupAttempts.set(email, { count: 1, firstAt: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

/**
 * Generates HTML for the double-opt-in confirmation email.
 * Inline-CSS, email-client-compatible, Levcon-branded.
 */
function buildConfirmationEmail(
  confirmUrl: string,
  email: string,
  language: 'de' | 'en',
): { subject: string; html: string; text: string } {
  if (language === 'en') {
    return {
      subject: 'Confirm your Levcon AI News subscription',
      text: `Please confirm your subscription to Levcon AI News.\n\nClick the link below:\n${confirmUrl}\n\nIf you didn't sign up, you can ignore this email.\n\n— Levcon.ai`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F0EFEC;font-family:Arial,Helvetica,sans-serif;color:#1C1C1A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0EFEC;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;max-width:600px;width:100%;padding:48px 40px;">
        <tr><td style="text-align:center;padding-bottom:32px;border-bottom:1px solid #D8D7D3;">
          <span style="font-size:14px;letter-spacing:0.26em;font-weight:500;color:#1C1C1A;">LEVCON<span style="color:#C8102E;">.AI</span></span>
        </td></tr>
        <tr><td style="padding:32px 0 24px;font-family:Georgia,serif;font-size:28px;font-weight:500;">Confirm your subscription</td></tr>
        <tr><td style="font-size:15px;line-height:1.6;padding-bottom:24px;color:#1C1C1A;">
          <p style="margin:0 0 16px;">Please confirm your subscription to <strong>Levcon AI News</strong>.</p>
          <p style="margin:0;">Email: <strong>${email}</strong></p>
        </td></tr>
        <tr><td style="padding:16px 0 32px;">
          <a href="${confirmUrl}" style="display:inline-block;background:#1C1C1A;color:#F0EFEC;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Confirm subscription</a>
        </td></tr>
        <tr><td style="padding-top:24px;border-top:1px solid #D8D7D3;font-size:13px;line-height:1.6;color:#8A8A85;">
          <p style="margin:0 0 8px;">Or copy this link into your browser:</p>
          <p style="margin:0 0 16px;word-break:break-all;"><a href="${confirmUrl}" style="color:#1C1C1A;">${confirmUrl}</a></p>
          <p style="margin:0;">If you didn't sign up, you can safely ignore this email.</p>
        </td></tr>
        <tr><td style="padding-top:32px;border-top:1px solid #D8D7D3;font-size:11px;color:#8A8A85;">
          <p style="margin:0;">Levcon.ai · Pfalzgasse 37/2/4 · 1220 Vienna, Austria</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    };
  }

  return {
    subject: 'Bestätigen Sie Ihr Levcon AI News Abonnement',
    text: `Bitte bestätigen Sie Ihr Abonnement der Levcon AI News.\n\nKlicken Sie auf den Link unten:\n${confirmUrl}\n\nFalls Sie sich nicht angemeldet haben, können Sie diese E-Mail ignorieren.\n\n— Levcon.ai`,
    html: `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F0EFEC;font-family:Arial,Helvetica,sans-serif;color:#1C1C1A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0EFEC;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;max-width:600px;width:100%;padding:48px 40px;">
        <tr><td style="text-align:center;padding-bottom:32px;border-bottom:1px solid #D8D7D3;">
          <span style="font-size:14px;letter-spacing:0.26em;font-weight:500;color:#1C1C1A;">LEVCON<span style="color:#C8102E;">.AI</span></span>
        </td></tr>
        <tr><td style="padding:32px 0 24px;font-family:Georgia,serif;font-size:28px;font-weight:500;">Bestätigung erforderlich</td></tr>
        <tr><td style="font-size:15px;line-height:1.6;padding-bottom:24px;color:#1C1C1A;">
          <p style="margin:0 0 16px;">Bitte bestätigen Sie Ihr Abonnement der <strong>Levcon AI News</strong>.</p>
          <p style="margin:0;">E-Mail: <strong>${email}</strong></p>
        </td></tr>
        <tr><td style="padding:16px 0 32px;">
          <a href="${confirmUrl}" style="display:inline-block;background:#1C1C1A;color:#F0EFEC;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Abonnement bestätigen</a>
        </td></tr>
        <tr><td style="padding-top:24px;border-top:1px solid #D8D7D3;font-size:13px;line-height:1.6;color:#8A8A85;">
          <p style="margin:0 0 8px;">Oder kopieren Sie diesen Link in Ihren Browser:</p>
          <p style="margin:0 0 16px;word-break:break-all;"><a href="${confirmUrl}" style="color:#1C1C1A;">${confirmUrl}</a></p>
          <p style="margin:0;">Falls Sie sich nicht angemeldet haben, können Sie diese E-Mail ignorieren.</p>
        </td></tr>
        <tr><td style="padding-top:32px;border-top:1px solid #D8D7D3;font-size:11px;color:#8A8A85;">
          <p style="margin:0;">Levcon.ai · Pfalzgasse 37/2/4 · 1220 Wien, Österreich</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SubscribeBody;
    const { email: rawEmail, frequency: rawFrequency, language: rawLanguage, website } = body;

    // Honeypot — bots fill this
    if (website) {
      // Return OK to not reveal detection
      return NextResponse.json({ success: true });
    }

    // Validation
    if (typeof rawEmail !== 'string' || !isValidEmail(rawEmail.trim().toLowerCase())) {
      return NextResponse.json({ error: 'Invalid email.' }, { status: 400 });
    }

    const email = rawEmail.trim().toLowerCase();

    if (typeof rawFrequency !== 'string' || !isValidFrequency(rawFrequency)) {
      return NextResponse.json({ error: 'Invalid frequency.' }, { status: 400 });
    }

    if (typeof rawLanguage !== 'string' || !isValidLanguage(rawLanguage)) {
      return NextResponse.json({ error: 'Invalid language.' }, { status: 400 });
    }

    // Rate limiting
    if (!checkRateLimit(email)) {
      return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });
    }

    // Check if email already exists
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (existing) {
      // If already confirmed → return 409
      if (existing.confirmedAt && !existing.unsubscribedAt) {
        return NextResponse.json({ error: 'Email already subscribed.' }, { status: 409 });
      }

      // If unconfirmed OR unsubscribed → update existing record with new token & reset
      const newToken = randomUUID();
      await db.newsletterSubscriber.update({
        where: { email },
        data: {
          frequency: rawFrequency,
          language: rawLanguage,
          confirmToken: newToken,
          confirmedAt: null,
          unsubscribedAt: null,
          createdAt: new Date(),
        },
      });
      await sendConfirmationEmail(email, newToken, rawLanguage);
      return NextResponse.json({ success: true });
    }

    // Create new subscriber (unconfirmed)
    const confirmToken = randomUUID();
    await db.newsletterSubscriber.create({
      data: {
        email,
        frequency: rawFrequency,
        language: rawLanguage,
        confirmToken,
      },
    });

    await sendConfirmationEmail(email, confirmToken, rawLanguage);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Newsletter signup error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

async function sendConfirmationEmail(
  email: string,
  token: string,
  language: 'de' | 'en',
): Promise<void> {
  const localePath = language === 'en' ? '/en' : '';
  const confirmUrl = `${SITE_URL}${localePath}/api/ai-news/confirm?token=${token}`;

  const { subject, html, text } = buildConfirmationEmail(confirmUrl, email, language);

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  await transporter.sendMail({
    from: `"Levcon AI News" <${NEWSLETTER_FROM}>`,
    to: email,
    subject,
    text,
    html,
    headers: {
      'List-Unsubscribe': `<${SITE_URL}/api/ai-news/unsubscribe?token=${token}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-Auto-Response-Suppress': 'All',
      'Auto-Submitted': 'auto-generated',
    },
  });
}

// Token expiry helper (exported for potential use elsewhere)
export const TOKEN_EXPIRY = TOKEN_EXPIRY_MS;
