// Anti-drift: openapi.json (dokumentasi publik) harus sync dengan route di routes/api/.
// Gagal = lupa update spec saat tambah/ubah endpoint publik.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const routesDir = join(here, '../src/routes/api');
const specPath = join(here, '../../web/public/docs/openapi.json');

interface OpenApiSpec {
  paths: Record<string, Record<string, unknown>>;
}

const spec = JSON.parse(readFileSync(specPath, 'utf8')) as OpenApiSpec;

function codeRoutes(): string[] {
  const routes: string[] = [];
  for (const file of readdirSync(routesDir)) {
    if (!file.endsWith('.ts') || file === 'index.ts') continue;
    const src = readFileSync(join(routesDir, file), 'utf8');
    for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)) {
      const path = m[2].replace(/:([a-z_]+)/gi, '{$1}');
      routes.push(`${m[1].toUpperCase()} /v1${path}`);
    }
  }
  return routes.sort();
}

function specRoutes(): string[] {
  const routes: string[] = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const method of Object.keys(methods)) {
      routes.push(`${method.toUpperCase()} ${path}`);
    }
  }
  return routes.sort();
}

describe('openapi sync', () => {
  it('semua route publik terdokumentasi di openapi.json (dan sebaliknya)', () => {
    // /health di-definisikan di src/index.ts, bukan routes/api/.
    const expected = [...codeRoutes(), 'GET /health'].sort();
    expect(specRoutes()).toEqual(expected);
  });
});
