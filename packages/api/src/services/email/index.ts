import type { Env } from '../../config';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export class EmailService {
  static async send(env: Env, input: SendEmailInput): Promise<void> {
    try {
      if (env.RESEND_API_KEY) {
        await sendViaResend(env, input);
        return;
      }
      if (!env.EMAIL) {
        console.warn(`[DEV EMAIL MOCK] To: ${input.to} | Subject: ${input.subject}`);
        console.warn(`[DEV EMAIL BODY]\n${input.text}`);
        return;
      }
      const { EmailMessage } = await import('cloudflare:email');
      const mime = buildMime(env.FROM_EMAIL, input);
      const message = new EmailMessage(env.FROM_EMAIL, input.to, mime);
      await env.EMAIL.send(message);
    } catch {
      // Fallback dev jika Cloudflare Email binding gagal/mock lokal
      console.warn(`[DEV EMAIL FALLBACK] To: ${input.to} | Subject: ${input.subject}`);
      console.warn(`[DEV EMAIL BODY]\n${input.text}`);
    }
  }
}

async function sendViaResend(env: Env, input: SendEmailInput): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend API ${res.status}`);
  }
}

// Cegah header injection (CRLF) dari input.
function clean(value: string): string {
  return value.replace(/[\r\n]/g, '');
}

function buildMime(from: string, input: SendEmailInput): string {
  const headers = [
    `From: ${clean(from)}`,
    `To: ${clean(input.to)}`,
    `Subject: ${clean(input.subject)}`,
    'MIME-Version: 1.0',
  ];
  if (!input.html) {
    headers.push('Content-Type: text/plain; charset=utf-8');
    return `${headers.join('\r\n')}\r\n\r\n${input.text}`;
  }
  const boundary = `----bits-${crypto.randomUUID()}`;
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    input.text,
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    input.html,
    `--${boundary}--`,
  ];
  return `${headers.join('\r\n')}\r\n\r\n${body.join('\r\n')}`;
}
