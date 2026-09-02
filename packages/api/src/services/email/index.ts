import type { Env } from '../../config';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export class EmailService {
  static async send(env: Env, input: SendEmailInput): Promise<void> {
    const { EmailMessage } = await import('cloudflare:email');
    const mime = buildMime(env.FROM_EMAIL, input);
    const message = new EmailMessage(env.FROM_EMAIL, input.to, mime);
    try {
      await env.EMAIL.send(message);
    } catch (err) {
      // Jangan bocorkan detail internal ke caller.
      console.error('Email send failed:', err);
      throw err;
    }
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
