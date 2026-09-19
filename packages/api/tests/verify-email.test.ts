import { describe, it, expect, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import { errorHandler } from '../src/middleware/error-handler';
import { authRoutes } from '../src/routes/auth';
import type { Env } from '../src/config';
import { mockDbDispatch, mockEnv } from './mock-env';

const APP_URL = 'http://localhost:7002';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Email Verification routes', () => {
  describe('GET /auth/verify-email', () => {
    it('returns 400 when token is missing', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.onError(errorHandler);
      app.route('/auth', authRoutes);

      const env = mockEnv({ APP_URL });
      const res = await app.request('/auth/verify-email', {}, env);
      expect(res.status).toBe(400);
      const json = await res.json<{ success: boolean; error: { code: string } }>();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('validation_error');
    });

    it('verifies user when token is valid', async () => {
      let batchExecuted = false;
      const db = mockDbDispatch([
        {
          match: 'SELECT id, user_id, expires_at, used FROM email_verifications',
          first: () => ({
            id: 'ev-1',
            user_id: 'usr-1',
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            used: 0,
          }),
        },
        {
          match: 'UPDATE users SET email_verified = 1',
          run: () => 1,
        },
        {
          match: 'UPDATE email_verifications SET used = 1',
          run: () => 1,
        },
      ]);
      // Mock batch on db
      db.batch = vi.fn().mockImplementation(async () => {
        batchExecuted = true;
        return [];
      });

      const app = new Hono<{ Bindings: Env }>();
      app.onError(errorHandler);
      app.route('/auth', authRoutes);

      const env = mockEnv({ DB: db, APP_URL });
      const res = await app.request('/auth/verify-email?token=valid-token', {}, env);
      expect(res.status).toBe(200);
      const json = await res.json<{ success: boolean; data: { message: string } }>();
      expect(json.success).toBe(true);
      expect(batchExecuted).toBe(true);
    });
  });

  describe('POST /auth/resend-verification', () => {
    it('returns 400 when neither token nor email provided', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.onError(errorHandler);
      app.route('/auth', authRoutes);

      const env = mockEnv({ APP_URL });
      const res = await app.request(
        '/auth/resend-verification',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        env,
      );
      expect(res.status).toBe(400);
      const json = await res.json<{ success: boolean; error: { code: string } }>();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('validation_error');
    });

    it('resends verification email successfully with valid email', async () => {
      let insertedVerification = false;
      const db = mockDbDispatch([
        {
          match: 'SELECT id, email, name, email_verified FROM users WHERE email',
          first: () => ({
            id: 'usr-unverified',
            email: 'unverified@example.com',
            name: 'Budi Test',
            email_verified: 0,
          }),
        },
        {
          match: 'SELECT created_at FROM email_verifications WHERE user_id',
          first: () => null,
        },
        {
          match: 'UPDATE email_verifications SET used = 1',
          run: () => 1,
        },
        {
          match: 'INSERT INTO email_verifications',
          run: () => {
            insertedVerification = true;
            return 1;
          },
        },
        {
          match: 'SELECT value FROM config WHERE key',
          first: () => null,
        },
      ]);

      const app = new Hono<{ Bindings: Env }>();
      app.onError(errorHandler);
      app.route('/auth', authRoutes);

      const env = mockEnv({ DB: db, APP_URL });
      const res = await app.request(
        '/auth/resend-verification',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'unverified@example.com' }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const json = await res.json<{ success: boolean; data: { message: string } }>();
      expect(json.success).toBe(true);
      expect(insertedVerification).toBe(true);
    });

    it('rate limits when resend is requested too quickly (< 60s)', async () => {
      const db = mockDbDispatch([
        {
          match: 'SELECT id, email, name, email_verified FROM users WHERE email',
          first: () => ({
            id: 'usr-unverified',
            email: 'unverified@example.com',
            name: 'Budi Test',
            email_verified: 0,
          }),
        },
        {
          match: 'SELECT created_at FROM email_verifications WHERE user_id',
          first: () => ({ created_at: new Date().toISOString() }),
        },
      ]);

      const app = new Hono<{ Bindings: Env }>();
      app.onError(errorHandler);
      app.route('/auth', authRoutes);

      const env = mockEnv({ DB: db, APP_URL });
      const res = await app.request(
        '/auth/resend-verification',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'unverified@example.com' }),
        },
        env,
      );
      expect(res.status).toBe(429);
      const json = await res.json<{ success: boolean; error: { message: string } }>();
      expect(json.success).toBe(false);
      expect(json.error.message.toLowerCase()).toContain('tunggu 1 menit');
    });
  });
});
