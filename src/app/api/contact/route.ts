import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// SMTP config — set via environment variables on the VPS
const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'hello@levcon.ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, message } = body;

    // Server-side validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }
    if (message && typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid message.' }, { status: 400 });
    }

    // Send email
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });

    await transporter.sendMail({
      from: `"Levcon.ai Kontaktformular" <${SMTP_USER || CONTACT_EMAIL}>`,
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `Neue Kontaktanfrage von ${name}`,
      text: [
        `Name: ${name}`,
        `E-Mail: ${email}`,
        '',
        message ? `Nachricht:\n${message}` : '(Keine Nachricht)',
      ].join('\n'),
      html: [
        `<p><strong>Name:</strong> ${name}</p>`,
        `<p><strong>E-Mail:</strong> <a href="mailto:${email}">${email}</a></p>`,
        message ? `<p><strong>Nachricht:</strong></p><p>${message.replace(/\n/g, '<br>')}</p>` : '<p><em>(Keine Nachricht)</em></p>',
      ].join(''),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 });
  }
}
