# BITS Pay — DevOps, CI/CD, Code Quality

## 1. Tech Stack Tools

| Tool                 | Guna                   | Config File             |
| -------------------- | ---------------------- | ----------------------- |
| **ESLint**           | Linter TypeScript      | `eslint.config.mjs`     |
| **Prettier**         | Formatter              | `.prettierrc`           |
| **Husky**            | Git hooks              | `.husky/`               |
| **lint-staged**      | Lint hanya file staged | `package.json`          |
| **commitlint**       | Conventional commit    | `commitlint.config.mjs` |
| **Vitest**           | Test runner            | `vitest.config.ts`      |
| **GitHub Actions**   | CI/CD                  | `.github/workflows/`    |
| **semantic-release** | Auto versioning        | `.releaserc.json`       |

## 2. Repository Structure

```
.github/
├── workflows/
│   ├── ci.yml               # Test + Lint tiap push
│   ├── deploy-api.yml        # Deploy Worker 1 (api)
│   └── deploy-web.yml        # Deploy Worker 2 (static)
├── CODEOWNERS
└── dependabot.yml

.husky/
├── pre-commit                # lint-staged
├── commit-msg                # commitlint
└── pre-push                  # test

docs/                             # Dokumentasi
packages/
├── api/                      # Worker 1 — Hono API (wrangler.jsonc)
├── shared/                   # Shared types + utils
├── web/                      # Worker 2 — Landing page (wrangler.jsonc)
├── user/                     # User dashboard (Svelte SPA)
└── admin/                    # Admin dashboard (Svelte SPA)
```

## 3. ESLint Config

```javascript
// eslint.config.mjs
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-duplicate-imports': 'error',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.config.*', '.wrangler/'],
  },
);
```

## 4. Prettier Config

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

## 5. Commit Convention

**Format:** `type(scope): description`

**Types:**

| Type       | Guna        |
| ---------- | ----------- |
| `feat`     | Fitur baru  |
| `fix`      | Bug fix     |
| `chore`    | Maintenance |
| `docs`     | Dokumentasi |
| `style`    | Formatting  |
| `refactor` | Refactor    |
| `test`     | Test        |
| `ci`       | CI/CD       |

**Contoh:**

```
feat(api): add POST /v1/charges endpoint
fix(auth): handle google oauth state expiry
docs: add API documentation
ci: add deploy workflow
```

## 6. Commitlint Config

```javascript
// commitlint.config.mjs
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'chore', 'docs', 'style', 'refactor', 'test', 'ci']],
    'scope-case': [2, 'always', 'lower-case'],
  },
};
```

## 7. lint-staged Config

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yaml,yml}": ["prettier --write"],
  "*.sql": ["prettier --write"]
}
```

## 8. Husky Hooks

### pre-commit

```bash
#!/bin/sh
pnpm exec lint-staged
```

### commit-msg

```bash
#!/bin/sh
pnpm exec commitlint --edit $1
```

### pre-push

```bash
#!/bin/sh
pnpm test
```

## 9. GitHub Actions

### CI — ci.yml (tiap push ke branch)

```yaml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec eslint packages/api/src packages/shared/src

  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec vitest run --reporter=verbose
```

### Deploy API — deploy-api.yml (manual, workflow_dispatch)

```yaml
name: Deploy API
on:
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @bits-pay/shared build
      - run: pnpm --filter @bits-pay/api build
      # Config (vars/secrets repo) ditulis ke .worker-secrets.json → wrangler secret bulk
      - name: Deploy to Cloudflare
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy
          workingDirectory: packages/api
```

### Deploy Web — deploy-web.yml (manual, workflow_dispatch)

```yaml
name: Deploy Web
on:
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @bits-pay/web build
      - run: pnpm --filter @bits-pay/user build
      - run: pnpm --filter @bits-pay/admin build
      - name: Deploy to Cloudflare
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy
          workingDirectory: packages/web
```

### Uptime Monitor — Uptime Kuma (eksternal)

Uptime dimonitor via Uptime Kuma (self-hosted, di luar repo ini). Target: `https://api.pay.bits.co.id/health`, `https://pay.bits.co.id/`, `https://pay.bits.co.id/status.html`.

## 10. Dependabot

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 5
    labels:
      - 'dependencies'

  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
```

## 11. Package.json Scripts

```json
{
  "scripts": {
    "dev": "pnpm --filter @bits-pay/api dev",
    "build": "pnpm --filter @bits-pay/shared build && pnpm --filter @bits-pay/api build",
    "build:all": "pnpm build && pnpm --filter @bits-pay/web build && pnpm --filter @bits-pay/user build && pnpm --filter @bits-pay/admin build",
    "lint": "eslint packages/api/src packages/shared/src",
    "lint:fix": "eslint --fix packages/api/src packages/shared/src",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "prepare": "husky",
    "commit": "git add . && pnpm exec cz",
    "deploy:api": "pnpm --filter @bits-pay/api deploy",
    "deploy:web": "pnpm --filter @bits-pay/web exec wrangler deploy"
  }
}
```

## 12. GitHub Secrets & Variables

Worker secrets (wajib rahasia, di-`wrangler secret bulk` saat deploy):

| Secret                 | Guna                |
| ---------------------- | ------------------- |
| `JWT_SECRET`           | JWT signing         |
| `GOOGLE_CLIENT_SECRET` | Google OAuth        |
| `QRIS_STATIC`          | Payload QRIS statis |

Config non-secret dibaca dari **Variables** (fallback Secrets) repo: `ADMIN_EMAILS`, `API_DOMAIN`, `API_URL`, `APP_URL`, `FROM_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI`, `JWT_EXPIRES_IN`, `MAX_UNIQUE_CODE`, `OCR_CONFIDENCE_THRESHOLD`, `PREMIUM_PRICE_MONTHLY`, `PREMIUM_PRICE_YEARLY`, `PROOF_RETENTION_DAYS`, `TRANSACTION_EXPIRE_MINUTES`, `VITE_API_URL`, `WEB_DOMAIN`, `WORKER_NAME`.

Infra CI:

| Secret / Variable       | Guna                         |
| ----------------------- | ---------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Deploy ke Cloudflare Workers |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID        |

## 13. .gitignore

```
node_modules/
dist/
.wrangler/
*.log
.env
.env.local
.DS_Store
coverage/
*.tsbuildinfo
```

## 14. .editorconfig

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

## 15. Install Command

```bash
# Init project
pnpm init
pnpm add -D -w \
  eslint typescript-eslint @eslint/js \
  prettier \
  husky lint-staged \
  @commitlint/cli @commitlint/config-conventional \
  vitest

# Init husky
pnpm exec husky init

# Setup hooks
echo "pnpm exec lint-staged" > .husky/pre-commit
echo "pnpm exec commitlint --edit \$1" > .husky/commit-msg
echo "pnpm test" > .husky/pre-push
chmod +x .husky/pre-commit .husky/commit-msg .husky/pre-push

# Init commitlint
echo "export default { extends: ['@commitlint/config-conventional'] }" > commitlint.config.mjs

# Setup lint-staged in package.json
```
