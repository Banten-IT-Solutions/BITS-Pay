# BITS Pay — Implementation Guide

Panduan untuk AI agent agar semua kode konsisten, testable, dan production-ready.

---

## 1. Error Handling Pattern

### AppError Class

Buat `packages/api/src/lib/errors.ts`:

```typescript
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(code: string, message: string, details?: Record<string, string[]>) {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(401, 'unauthorized', message);
  }

  static notFound(entity = 'Resource') {
    return new AppError(404, 'not_found', `${entity} tidak ditemukan`);
  }

  static conflict(code: string, message: string) {
    return new AppError(409, code, message);
  }

  static tooMany(message = 'Rate limit tercapai') {
    return new AppError(429, 'rate_limited', message);
  }

  static internal(message = 'Internal server error') {
    return new AppError(500, 'internal_error', message);
  }
}
```

### Error Handler Middleware

Buat `packages/api/src/middleware/error-handler.ts`:

```typescript
import { Context } from 'hono';
import { AppError } from '../lib/errors';

export async function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        error: { code: err.code, message: err.message, details: err.details },
      },
      err.statusCode,
    );
  }

  console.error('Unhandled error:', err);
  return c.json(
    {
      success: false,
      error: { code: 'internal_error', message: 'Internal server error' },
    },
    500,
  );
}
```

### Response Helpers

Buat `packages/api/src/lib/response.ts`:

```typescript
import { Context } from 'hono';

export function success<T>(c: Context, data: T, status = 200, meta?: object) {
  return c.json({ success: true, data, ...(meta ? { meta } : {}) }, status);
}

export function paginated<T>(c: Context, data: T[], total: number, page: number, perPage: number) {
  return success(c, data, 200, { page, per_page: perPage, total });
}
```

### Validasi dengan Zod

Buat `packages/api/src/lib/validate.ts`:

```typescript
import { z } from 'zod';
import { Context } from 'hono';
import { AppError } from './errors';

export async function validateBody<T>(c: Context, schema: z.ZodSchema<T>): Promise<T> {
  const body = await c.req.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    const details: Record<string, string[]> = {};
    result.error.issues.forEach((issue) => {
      const path = issue.path.join('.');
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    });
    throw AppError.badRequest('validation_error', 'Validasi gagal', details);
  }
  return result.data;
}
```

---

## 2. Route Handler Pattern

### Struktur File per Route

```
routes/auth/
├── index.ts          # Hono router, mount semua sub-routes
├── signup.ts         # POST /auth/signup
├── login.ts          # POST /auth/login
├── logout.ts         # POST /auth/logout
└── google.ts         # GET /auth/google, GET /auth/google/callback
```

### Contoh Route Handler

`routes/auth/signup.ts`:

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { validateBody } from '../../lib/validate';
import { success } from '../../lib/response';
import { AuthService } from '../../services/auth';

const router = new Hono();

const schema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  name: z.string().min(1, 'Nama wajib diisi'),
});

router.post('/', async (c) => {
  const input = await validateBody(c, schema);
  const result = await AuthService.signup(c.env, input);
  return success(c, result, 201);
});

export { router as signupRoute };
```

### Mounting di Router Index

`routes/auth/index.ts`:

```typescript
import { Hono } from 'hono';
import { signupRoute } from './signup';
import { loginRoute } from './login';
// ...

const router = new Hono();
router.route('/signup', signupRoute);
router.route('/login', loginRoute);
// ...

export { router as authRoutes };
```

### Mounting di Entry Point

`src/index.ts`:

```typescript
import { Hono } from 'hono';
import { errorHandler } from './middleware/error-handler';
import { authRoutes } from './routes/auth';

const app = new Hono<{ Bindings: Env }>();

app.onError(errorHandler);

app.route('/auth', authRoutes);
// ...

export default app;
```

---

## 3. Auth Middleware Pattern

### JWT Middleware

`middleware/auth.ts`:

```typescript
import { createMiddleware } from 'hono/factory';
import { AppError } from '../lib/errors';
import { verifyJWT } from '@bits-pay/shared'; // atau utils lokal

declare module 'hono' {
  interface ContextVariableMap {
    user: { id: string; email: string; tier: string };
  }
}

export const requireAuth = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw AppError.unauthorized('Token tidak ditemukan');
  }
  const token = header.slice(7);
  try {
    const payload = await verifyJWT<{ id: string; email: string; tier: string }>(
      token,
      c.env.JWT_SECRET,
    );
    c.set('user', payload);
    await next();
  } catch {
    throw AppError.unauthorized('Token tidak valid atau expired');
  }
});
```

### API Key Middleware

`middleware/api-key.ts`:

```typescript
import { createMiddleware } from 'hono/factory';
import { AppError } from '../lib/errors';
import { hashApiKey } from '@bits-pay/shared';

declare module 'hono' {
  interface ContextVariableMap {
    app: { id: string; workspace_id: string };
  }
}

export const requireApiKey = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer sk_')) {
    throw AppError.unauthorized('API key tidak valid');
  }
  const key = header.slice(7);
  const hash = await hashApiKey(key);
  const app = await c.env.DB.prepare(
    'SELECT id, workspace_id, is_active FROM apps WHERE api_key_hash = ?',
  )
    .bind(hash)
    .first<{ id: string; workspace_id: string; is_active: number }>();
  if (!app || !app.is_active) throw AppError.unauthorized('API key tidak dikenal');
  c.set('app', { id: app.id, workspace_id: app.workspace_id });
  await next();
});
```

---

## 4. Service Layer Pattern

### Struktur Service

```
services/
├── auth.ts           # Signup, login, google OAuth, verify email
├── workspace.ts      # CRUD workspace, member management
├── app.ts            # CRUD app, API key management
├── payment.ts        # Create charge, confirm, matching logic
├── qr.ts             # QRIS static → dynamic, QR image generation
├── callback.ts       # Queue callback, retry logic
├── ocr/              # OCR provider abstraction
│   ├── index.ts      # OCRService interface
│   └── workers-ai.ts # Workers AI implementation
└── email/            # Email sending
    └── index.ts      # Kirim email via Cloudflare Email Service
```

### Contoh Service Pattern

```typescript
// services/auth.ts
export class AuthService {
  static async signup(env: Env, input: { email: string; password: string; name: string }) {
    // 1. Validasi: email sudah terdaftar?
    // 2. Hash password
    // 3. INSERT user
    // 4. Generate verification token
    // 5. Kirim email verifikasi
    // 6. Generate JWT
    // 7. Return { user, token }
  }

  static async login(env: Env, input: { email: string; password: string }) {
    // 1. Cari user by email
    // 2. Verifikasi password
    // 3. Update last_login_at
    // 4. Generate JWT
    // 5. Return { user, token }
  }
}
```

---

## 5. D1 Query Pattern

Gunakan prepared statements, jangan string concatenation.

```typescript
// ✅ Correct
const user = await c.env.DB.prepare('SELECT id, email, name, tier FROM users WHERE email = ?')
  .bind(email)
  .first<User>();

// ✅ Insert with RETURNING
const result = await c.env.DB.prepare(
  'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?) RETURNING id',
)
  .bind(id, email, hash, name)
  .first();

// ✅ Pagination
const { results } = await c.env.DB.prepare(
  'SELECT * FROM payments WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
)
  .bind(workspaceId, limit, offset)
  .all<Payment>();

// ❌ Wrong: jangan string interpolation
// await c.env.DB.prepare(`SELECT * FROM users WHERE id = ${id}`).all();
```

---

## 6. Auth Flow (Token Storage)

### User Dashboard (Svelte SPA)

```
Login → API return { token, user }
       → localStorage.setItem('token', token)
       → Redirect ke dashboard
       → Setiap fetch: header Authorization: Bearer {token}

Logout → localStorage.removeItem('token')
       → Redirect ke /login
```

**Pertimbangan:** localStorage dipilih karena:

- Sederhana untuk SPA
- Tidak perlu CSRF protection
- Cookie HttpOnly butuh server-side rendering
- XSS risiko dimitigasi dengan CSP + sanitasi

### API Key (External Apps)

```
Developer create app → dapat API key sekali (sk_...)
                     → Simpan key, tidak bisa dilihat lagi
                     → Setiap request: header Authorization: Bearer sk_...
```

---

## 7. Svelte Component Pattern

### Struktur File

```
components/
├── ui/               # Shared components
│   ├── Button.svelte
│   ├── Input.svelte
│   ├── Table.svelte
│   ├── Badge.svelte
│   ├── Modal.svelte
│   ├── Toast.svelte
│   ├── Card.svelte
│   ├── Pagination.svelte
│   └── Loading.svelte
├── layout/           # Layout components
│   ├── Sidebar.svelte
│   ├── Navbar.svelte
│   └── DashboardLayout.svelte
└── features/         # Feature-specific components
    ├── PaymentReviewCard.svelte
    ├── InvoiceCard.svelte
    ├── ApiKeyDisplay.svelte
    └── WorkspaceCard.svelte
```

### Contoh Component

```svelte
<!-- components/ui/Button.svelte -->
<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled = false;
  export let loading = false;
  export let type: 'button' | 'submit' = 'button';
</script>

<button
  {type}
  class="btn btn-{variant} btn-{size}"
  {disabled}
  on:click
>
  {#if loading}
    <span class="spinner" />
  {/if}
  <slot />
</button>

<style>
  .btn { /* Tailwind classes */ }
  .btn-primary { @apply bg-primary-500 text-white hover:bg-primary-600; }
  .btn-danger { @apply bg-error text-white hover:bg-red-700; }
</style>
```

---

## 8. Svelte Store Pattern

### Struktur Store

```
stores/
├── auth.ts           # User, token, login/logout
├── workspace.ts      # Active workspace, list
├── payment.ts        # Payment list, filter
└── notification.ts   # Toast notifications
```

### Contoh Store

```typescript
// stores/auth.ts
import { writable } from 'svelte/store';
import type { User } from '@bits-pay/shared';

export const currentUser = writable<User | null>(null);
export const token = writable<string | null>(localStorage.getItem('token'));

export function login(user: User, jwt: string) {
  currentUser.set(user);
  token.set(jwt);
  localStorage.setItem('token', jwt);
}

export function logout() {
  currentUser.set(null);
  token.set(null);
  localStorage.removeItem('token');
}
```

---

## 9. API Client Pattern

### Fetch Wrapper

```typescript
// lib/api.ts
import { get } from 'svelte/store';
import { token } from '../stores/auth';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://api.pay.bits.co.id';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | undefined>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const jwt = get(token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

  let url = `${BASE_URL}${path}`;
  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new ApiError(json.error?.code || 'unknown', json.error?.message || 'Error', res.status);
  }
  return json.data;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | undefined>) =>
    request<T>(path, { params }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => {
    const jwt = get(token);
    return fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
      body: formData,
    })
      .then((r) => r.json())
      .then((j) => j.data as T);
  },
};
```

---

## 10. Environment Variables

### Wrangler vars (Worker 1 - API)

Didefinisikan di `packages/api/wrangler.jsonc`:

| Variable                     | Default                                       | Description                       |
| ---------------------------- | --------------------------------------------- | --------------------------------- |
| `APP_URL`                    | `https://pay.bits.co.id`                      | URL frontend                      |
| `FROM_EMAIL`                 | `noreply@pay.bits.co.id`                      | Email pengirim                    |
| `QRIS_STATIC`                | `""`                                          | QRIS static string untuk konversi |
| `TRANSACTION_EXPIRE_MINUTES` | `15`                                          | Expiry time dalam menit           |
| `PREMIUM_PRICE_MONTHLY`      | `50000`                                       | Harga premium bulanan             |
| `PREMIUM_PRICE_YEARLY`       | `500000`                                      | Harga premium tahunan             |
| `GOOGLE_CLIENT_ID`           | `""`                                          | Google OAuth client ID            |
| `GOOGLE_REDIRECT_URI`        | `https://pay.bits.co.id/auth/google/callback` | Redirect URI                      |
| `JWT_EXPIRES_IN`             | `7d`                                          | JWT expiry                        |
| `JWT_SECRET`                 | `""`                                          | JWT signing secret (**secret**)   |
| `OCR_CONFIDENCE_THRESHOLD`   | `85`                                          | Threshold auto-confirm            |
| `MAX_UNIQUE_CODE`            | `9999`                                        | Max unique code range             |
| `PROOF_RETENTION_DAYS`       | `30`                                          | Retention bukti bayar             |

### Env Type Definition

```typescript
// src/index.ts atau config.ts
export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  EMAIL: SendEmail;
  AI: Ai;
  CALLBACK_QUEUE: Queue<unknown>;
  APP_URL: string;
  FROM_EMAIL: string;
  QRIS_STATIC: string;
  TRANSACTION_EXPIRE_MINUTES: string;
  PREMIUM_PRICE_MONTHLY: string;
  PREMIUM_PRICE_YEARLY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_REDIRECT_URI: string;
  JWT_EXPIRES_IN: string;
  JWT_SECRET: string;
  OCR_CONFIDENCE_THRESHOLD: string;
  MAX_UNIQUE_CODE: string;
  PROOF_RETENTION_DAYS: string;
}
```

---

## 11. Test Pattern

### Unit Test Example (Vitest)

```typescript
// tests/api/auth.test.ts
import { describe, it, expect, vi, beforeAll } from 'vitest';

describe('AuthService', () => {
  it('should return 400 for invalid email', async () => {
    // ...
  });

  it('should reject duplicate email', async () => {
    // ...
  });

  it('should return token on valid login', async () => {
    // ...
  });
});
```

### Mocking Strategy

- **D1**: Mock `c.env.DB.prepare().bind().first()` chain
- **R2**: Mock `c.env.R2.put()` / `c.env.R2.get()`
- **Email**: Mock `c.env.EMAIL.send()`
- **Queue**: Mock `c.env.CALLBACK_QUEUE.send()`
- **Workers AI**: Mock `c.env.AI.run()`

### Test Structure

```
tests/
├── api/
│   ├── auth.test.ts
│   ├── charges.test.ts
│   ├── payments.test.ts
│   └── workspace.test.ts
├── services/
│   ├── unique-code.test.ts
│   ├── qr.test.ts
│   └── callback.test.ts
└── helpers/
    ├── setup.ts        # Test setup, env vars
    └── mocks.ts        # Mock helpers
```

---

## 12. File Organization Rules

Setiap route handler maksimal 1 file per endpoint.
Service class method maksimal 30 baris.
Jika lebih → refactor ke method/fungsi terpisah.

### Event Flow per Request

```
Request → Hono Router → Middleware (auth, rate-limit)
  → Route Handler (validasi, parse)
  → Service (business logic, DB queries)
  → Response (success/paginated/error)
```

### Naming Convention

| Item           | Convention      | Example                                   |
| -------------- | --------------- | ----------------------------------------- |
| File route     | `kebab-case.ts` | `signup.ts`, `create-charge.ts`           |
| Class          | PascalCase      | `AuthService`, `PaymentService`           |
| Function       | camelCase       | `generateUniqueCode()`, `extractAmount()` |
| Variable       | camelCase       | `userInput`, `amountDue`                  |
| DB Table       | snake_case      | `workspace_members`, `tier_features`      |
| Type           | PascalCase      | `User`, `PaymentStatus`, `ApiResponse<T>` |
| Enum/file type | PascalCase      | `PaymentStatus`, `MatchResult`            |

---

## 13. Svelte Routing Pattern

Gunakan `svelte-spa-router` dengan hash-based routing:

```typescript
// main.ts
import Router from 'svelte-spa-router';
import { wrap } from 'svelte-spa-router/wrap';

const routes = {
  '/': wrap({ component: OverviewPage }),
  '/workspaces': wrap({ component: WorkspaceListPage }),
  '/workspaces/:id': wrap({ component: WorkspaceDetailPage }),
  '/apps': wrap({ component: AppListPage }),
  '/payments': wrap({ component: PaymentListPage }),
  '/payments/:id': wrap({ component: PaymentDetailPage }),
  '/subscription': wrap({ component: SubscriptionPage }),
  '/invoices': wrap({ component: InvoiceListPage }),
  '/team': wrap({ component: TeamPage }),
  '/settings': wrap({ component: SettingsPage }),
  '*': wrap({ component: NotFoundPage }),
};
```

---

## 14. Cron Job Pattern

`wrangler.jsonc` cron: `*/5 * * * *`

```typescript
// src/index.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    switch (event.cron) {
      case '*/5 * * * *':
        await expireTransactions(env);
        await checkSubscriptionExpiry(env);
        await sendInvoiceReminders(env);
        break;
    }
  },
};

async function expireTransactions(env: Env) {
  await env.DB.prepare(
    `UPDATE payments SET status = 'expired', updated_at = datetime('now')
     WHERE status = 'pending' AND expired_at < datetime('now')`,
  ).run();
}
```

---

## 15. Daftar Prioritasi Implementasi (untuk AI Agent)

Urutan implementasi berdasarkan dependencies (Sprint 1):

| Urutan | Feature                     | Files                                                               |
| ------ | --------------------------- | ------------------------------------------------------------------- |
| 1      | **Shared types + utils**    | `packages/shared/src/types/index.ts`, `packages/shared/src/utils/*` |
| 2      | **DB migration**            | `packages/api/src/db/migrations/0001_initial.sql`                   |
| 3      | **Hono entry + middleware** | `packages/api/src/index.ts`, `middleware/`, `lib/`                  |
| 4      | **Auth routes**             | `routes/auth/` (signup, login, logout, google, verify, reset)       |
| 5      | **Workspace + App routes**  | `routes/app/` (workspaces, apps, members)                           |
| 6      | **Core Payment routes**     | `routes/api/` (charges, payments, confirm)                          |
| 7      | **QRIS + OCR services**     | `services/qr.ts`, `services/ocr/`                                   |
| 8      | **Callback + Queue**        | `services/callback.ts`                                              |
| 9      | **Landing page**            | `packages/web/`                                                     |
| 10     | **User Dashboard**          | `packages/user/`                                                    |
| 11     | **Admin Dashboard**         | `packages/admin/`                                                   |
| 12     | **Tests**                   | `tests/`                                                            |
| 13     | **Deploy**                  | GitHub Actions                                                      |

---

## 16. Ringkasan Checklist untuk AI Agent

Sebelum mulai coding, pastikan sudah baca:

- [ ] `docs/PRD.md` — fitur & prioritas
- [ ] `docs/ARCHITECTURE.md` — arsitektur 2 worker, routing, data flow
- [ ] `docs/API.md` — endpoint spec (request/response/error)
- [ ] `docs/DATABASE.md` — schema DDL & relations
- [ ] `docs/UI_DESIGN.md` — color, typography, layout, components
- [ ] `docs/SPRINT.md` — task breakdown & dependencies
- [ ] `docs/IMPLEMENTATION_GUIDE.md` — pattern & convention (ini)
- [ ] `packages/shared/src/types/index.ts` — type definitions
- [ ] `packages/api/src/db/migrations/0001_initial.sql` — migration SQL
- [ ] `packages/api/wrangler.jsonc` — env vars & bindings

**Rules:**

- Setiap new file harus ada type yang sesuai di shared/types
- Setiap endpoint harus ada schema Zod untuk validasi
- Setiap service harus ada error handling dengan AppError
- Setiap Svelte component harus ada loading + error + empty state
- Jangan commit secrets, API keys, atau token
- Jangan gunakan `any` — always use proper types
