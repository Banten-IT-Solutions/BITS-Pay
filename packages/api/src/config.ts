// BITS Pay — API Worker env bindings & vars (mirror wrangler.jsonc)
export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  EMAIL: SendEmail;
  AI: Ai;
  CALLBACK_QUEUE: Queue<unknown>;
  RATE_LIMITER: DurableObjectNamespace;
  APP_URL: string;
  FROM_EMAIL: string;
  QRIS_STATIC: string;
  TRANSACTION_EXPIRE_MINUTES: string;
  PREMIUM_PRICE_MONTHLY: string;
  PREMIUM_PRICE_YEARLY: string;
  GOOGLE_CLIENT_ID: string;
  // ponytail: secret, set via `wrangler secret put` — dibutuhkan untuk code exchange Google OAuth
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  OCR_CONFIDENCE_THRESHOLD: string;
  MAX_UNIQUE_CODE: string;
  PROOF_RETENTION_DAYS: string;
  // Comma-separated email admin, mis: "a@x.com,b@y.com"
  ADMIN_EMAILS: string;
}
