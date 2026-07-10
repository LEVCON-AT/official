import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
import { db } from '@/lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';

// SMTP config (shared with contact form)
const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const NEWSLETTER_FROM = process.env.SMTP_FROM || `"Levcon AI News" <${SMTP_USER}>`;
const NEWSLETTER_REPLY_TO = process.env.SMTP_REPLY_TO || 'hello@levcon.ai';
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
  newsLanguages?: unknown;
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
 * Loads the confirmation email HTML template from ai-news/templates/
 * and replaces placeholders with actual values.
 *
 * Templates: ai-news/templates/confirmation-html-de.html (+ en.html)
 * Placeholders: {{SUBSCRIBER_EMAIL}}, {{CONFIRM_URL}}
 */
function buildConfirmationEmail(
  confirmUrl: string,
  email: string,
  language: 'de' | 'en',
): { subject: string; html: string; text: string } {
  // Load template from filesystem
  const templateFile = language === 'en' ? 'confirmation-html-en.html' : 'confirmation-html-de.html';
  const templatePath = join(process.cwd(), 'ai-news', 'templates', templateFile);
  let htmlTemplate = '';
  try {
    htmlTemplate = readFileSync(templatePath, 'utf-8');
  } catch (err) {
    console.error('Failed to load confirmation template:', err);
    throw new Error('Confirmation email template not found');
  }

  // Replace placeholders
  const html = htmlTemplate
    .replace(/\{\{SUBSCRIBER_EMAIL\}\}/g, email)
    .replace(/\{\{CONFIRM_URL\}\}/g, confirmUrl);

  // Plain text version (for spam filters and non-HTML clients)
  const text = language === 'en'
    ? `Please confirm your subscription to Levcon AI News.\n\nClick the link below:\n${confirmUrl}\n\nIf you didn't sign up, you can ignore this email.\n\n— Levcon.ai`
    : `Bitte bestätigen Sie Ihr Abonnement der Levcon AI News.\n\nKlicken Sie auf den Link unten:\n${confirmUrl}\n\nFalls Sie sich nicht angemeldet haben, können Sie diese E-Mail ignorieren.\n\n— Levcon.ai`;

  const subject = language === 'en'
    ? 'Confirm your Levcon AI News subscription'
    : 'Bestätigen Sie Ihr Levcon AI News Abonnement';

  return { subject, html, text };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SubscribeBody;
    const { email: rawEmail, frequency: rawFrequency, language: rawLanguage, newsLanguages: rawNewsLanguages, website } = body;

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

    // Validate newsLanguages (comma-separated, e.g. "de,en,zh")
    let newsLanguages = 'de,en';
    if (typeof rawNewsLanguages === 'string') {
      const validLangs = ['de', 'en', 'zh', 'ja', 'fr', 'es', 'it', 'pt', 'ru', 'ar', 'tr', 'nl', 'pl', 'ko', 'hi'];
      const requested = rawNewsLanguages.split(',').map(l => l.trim()).filter(l => validLangs.includes(l));
      if (requested.length > 0) {
        newsLanguages = requested.join(',');
      }
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
          newsLanguages: newsLanguages,
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
        newsLanguages: newsLanguages,
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
  // Confirm-URL: /confirm page (not /api/ai-news/confirm) — looks cleaner
  // for spam filters like Sophos, no /api/ path that triggers warnings.
  const confirmUrl = `${SITE_URL}${localePath}/confirm?token=${token}`;

  const { subject, html, text } = buildConfirmationEmail(confirmUrl, email, language);

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  await transporter.sendMail({
    from: NEWSLETTER_FROM,
    to: email,
    replyTo: NEWSLETTER_REPLY_TO,
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
