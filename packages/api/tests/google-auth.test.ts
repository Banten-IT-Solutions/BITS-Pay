import { describe, it, expect, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import { errorHandler } from '../src/middleware/error-handler';
import { authRoutes } from '../src/routes/auth';
import type { Env } from '../src/config';
import { mockDbDispatch, mockEnv } from './mock-env';

const APP_URL = 'http://localhost:7002';
const GOOGLE_CLIENT_ID = 'test-google-client-id';
const GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
const GOOGLE_REDIRECT_URI = 'http://localhost:7001/auth/google/callback';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Google OAuth routes', () => {
  describe('GET /auth/google', () => {
    it('redirects to Google Accounts URL when configured', async () => {
      let insertedState = '';
      const db = mockDbDispatch([
        {
          match: 'INSERT INTO oauth_states',
          run: ([_id, state]: unknown[]) => {
            insertedState = state as string;
            return 1;
          },
        },
      ]);

      const app = new Hono<{ Bindings: Env }>();
      app.onError(errorHandler);
      app.route('/auth', authRoutes);

      const env = mockEnv({
        DB: db,
        APP_URL,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI,
      });

      const res = await app.request('/auth/google', {}, env);
      expect(res.status).toBe(302);
      const location = res.headers.get('location')!;
      expect(location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(location).toContain(`client_id=${GOOGLE_CLIENT_ID}`);
      expect(location).toContain(`state=${insertedState}`);
    });

    it('returns 400 when GOOGLE_CLIENT_ID is not configured', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.onError(errorHandler);
      app.route('/auth', authRoutes);

      const env = mockEnv({
        DB: mockDbDispatch([]),
        APP_URL,
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
        GOOGLE_REDIRECT_URI,
      });

      const res = await app.request('/auth/google', {}, env);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('google_auth_not_configured');
    });
  });

  describe('GET /auth/google/callback', () => {
    it('redirects to login when user cancels on Google consent screen (error param)', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.onError(errorHandler);
      app.route('/auth', authRoutes);

      const env = mockEnv({
        DB: mockDbDispatch([]),
        APP_URL,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI,
      });

      const res = await app.request('/auth/google/callback?error=access_denied', {}, env);
      expect(res.status).toBe(302);
      const location = res.headers.get('location')!;
      expect(location).toBe(`${APP_URL}/user/#/login`);
    });

    it('creates new user with trial tier and redirects with auth code', async () => {
      const state = 'valid-state-123';
      let insertedUserId = '';
      let generatedAuthCode = '';

      const db = mockDbDispatch([
        {
          match: 'SELECT id, used, expires_at FROM oauth_states WHERE state = ?',
          first: () => ({
            id: 'state-id-1',
            used: 0,
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        },
        {
          match: 'UPDATE oauth_states SET used = 1',
          run: () => 1,
        },
        {
          match: 'SELECT id FROM users WHERE google_id = ?',
          first: () => null,
        },
        {
          match: 'SELECT id, email_verified, google_id FROM users WHERE email = ?',
          first: () => null,
        },
        {
          match: 'INSERT INTO users',
          first: ([id]: unknown[]) => {
            insertedUserId = id as string;
            return { id };
          },
        },
        {
          match: 'INSERT INTO auth_codes',
          run: ([_id, _userId, code]: unknown[]) => {
            generatedAuthCode = code as string;
            return 1;
          },
        },
      ]);

      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          return Promise.resolve(
            new Response(JSON.stringify({ access_token: 'mock-google-token' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        if (url === 'https://www.googleapis.com/oauth2/v2/userinfo') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 'google-uid-999',
                email: 'newuser@example.com',
                name: 'New Google User',
                picture: 'https://example.com/avatar.jpg',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.reject(new Error(`Unhandled url: ${url}`));
      });
      vi.stubGlobal('fetch', fetchMock);

      const app = new Hono<{ Bindings: Env }>();
      app.onError(errorHandler);
      app.route('/auth', authRoutes);

      const env = mockEnv({
        DB: db,
        APP_URL,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI,
      });

      const res = await app.request(`/auth/google/callback?code=mock-code&state=${state}`, {}, env);
      expect(res.status).toBe(302);
      const location = res.headers.get('location')!;
      expect(location).toContain(`${APP_URL}/user/`);
      expect(location).toContain(`code=${generatedAuthCode}`);
      expect(location).toContain('#/auth/callback');
      expect(insertedUserId).toBeTruthy();
    });

    it('logs in existing user linked with google_id', async () => {
      const state = 'valid-state-existing';
      let generatedAuthCode = '';

      const db = mockDbDispatch([
        {
          match: 'SELECT id, used, expires_at FROM oauth_states WHERE state = ?',
          first: () => ({
            id: 'state-id-2',
            used: 0,
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        },
        {
          match: 'UPDATE oauth_states SET used = 1',
          run: () => 1,
        },
        {
          match: 'SELECT id FROM users WHERE google_id = ?',
          first: () => ({ id: 'existing-user-id' }),
        },
        {
          match: 'UPDATE users SET last_login_at',
          run: () => 1,
        },
        {
          match: 'INSERT INTO auth_codes',
          run: ([_id, _userId, code]: unknown[]) => {
            generatedAuthCode = code as string;
            return 1;
          },
        },
      ]);

      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          return Promise.resolve(
            new Response(JSON.stringify({ access_token: 'mock-google-token' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        if (url === 'https://www.googleapis.com/oauth2/v2/userinfo') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 'google-uid-existing',
                email: 'existing@example.com',
                name: 'Existing User',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.reject(new Error(`Unhandled url: ${url}`));
      });
      vi.stubGlobal('fetch', fetchMock);

      const app = new Hono<{ Bindings: Env }>();
      app.onError(errorHandler);
      app.route('/auth', authRoutes);

      const env = mockEnv({
        DB: db,
        APP_URL,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI,
      });

      const res = await app.request(`/auth/google/callback?code=mock-code&state=${state}`, {}, env);
      expect(res.status).toBe(302);
      const location = res.headers.get('location')!;
      expect(location).toContain(`code=${generatedAuthCode}`);
    });

    it('rejects with conflict if email exists but is not verified', async () => {
      const state = 'valid-state-unverified';

      const db = mockDbDispatch([
        {
          match: 'SELECT id, used, expires_at FROM oauth_states WHERE state = ?',
          first: () => ({
            id: 'state-id-3',
            used: 0,
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        },
        {
          match: 'UPDATE oauth_states SET used = 1',
          run: () => 1,
        },
        {
          match: 'SELECT id FROM users WHERE google_id = ?',
          first: () => null,
        },
        {
          match: 'SELECT id, email_verified, google_id FROM users WHERE email = ?',
          first: () => ({ id: 'unverified-id', email_verified: 0, google_id: null }),
        },
      ]);

      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          return Promise.resolve(
            new Response(JSON.stringify({ access_token: 'mock-google-token' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        if (url === 'https://www.googleapis.com/oauth2/v2/userinfo') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 'google-uid-unverified',
                email: 'unverified@example.com',
                name: 'Unverified Account',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.reject(new Error(`Unhandled url: ${url}`));
      });
      vi.stubGlobal('fetch', fetchMock);

      const app = new Hono<{ Bindings: Env }>();
      app.onError(errorHandler);
      app.route('/auth', authRoutes);

      const env = mockEnv({
        DB: db,
        APP_URL,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI,
      });

      const res = await app.request(`/auth/google/callback?code=mock-code&state=${state}`, {}, env);
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('google_link_failed');
    });
  });

  describe('POST /auth/exchange', () => {
    it('exchanges valid auth code for JWT token and user profile', async () => {
      let codeMarkedUsed = false;
      const db = mockDbDispatch([
        {
          match: 'SELECT id, user_id, expires_at, used FROM auth_codes WHERE code = ?',
          first: () => ({
            id: 'code-row-1',
            user_id: 'user-exchange-1',
            expires_at: new Date(Date.now() + 60000).toISOString(),
            used: 0,
          }),
        },
        {
          match: 'UPDATE auth_codes SET used = 1',
          run: () => {
            codeMarkedUsed = true;
            return 1;
          },
        },
        {
          match:
            'SELECT id, email, name, avatar_url, tier, status, token_version FROM users WHERE id = ?',
          first: () => ({
            id: 'user-exchange-1',
            email: 'exchange@test.com',
            name: 'Exchange User',
            avatar_url: null,
            tier: 'premium',
            status: 'active',
            token_version: 0,
          }),
        },
      ]);

      const app = new Hono<{ Bindings: Env }>();
      app.onError(errorHandler);
      app.route('/auth', authRoutes);

      const env = mockEnv({
        DB: db,
        JWT_SECRET: 'test-jwt-secret-min-32-chars-long!!',
        JWT_EXPIRES_IN: '7d',
      });

      const res = await app.request(
        '/auth/exchange',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'valid-auth-code' }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { token: string; user: { id: string; email: string } };
      };
      expect(json.success).toBe(true);
      expect(json.data.token).toBeTruthy();
      expect(json.data.user.email).toBe('exchange@test.com');
      expect(codeMarkedUsed).toBe(true);
    });

    it('rejects exchange if code is already used', async () => {
      const db = mockDbDispatch([
        {
          match: 'SELECT id, user_id, expires_at, used FROM auth_codes WHERE code = ?',
          first: () => ({
            id: 'code-row-used',
            user_id: 'user-1',
            expires_at: new Date(Date.now() + 60000).toISOString(),
            used: 1,
          }),
        },
      ]);

      const app = new Hono<{ Bindings: Env }>();
      app.onError(errorHandler);
      app.route('/auth', authRoutes);

      const env = mockEnv({
        DB: db,
        JWT_SECRET: 'test-jwt-secret-min-32-chars-long!!',
      });

      const res = await app.request(
        '/auth/exchange',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'already-used-code' }),
        },
        env,
      );

      expect(res.status).toBe(401);
    });
  });
});
