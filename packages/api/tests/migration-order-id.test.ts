import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SQL = readFileSync(
  fileURLToPath(new URL('../src/db/migrations/0009_partial_order_id.sql', import.meta.url)),
  'utf8',
);

function setup(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE payments (id TEXT PRIMARY KEY, app_id TEXT NOT NULL, order_id TEXT, status TEXT NOT NULL)',
  );
  db.exec(SQL);
  return db;
}

function insert(
  db: DatabaseSync,
  id: string,
  appId: string,
  orderId: string | null,
  status: string,
): void {
  db.prepare('INSERT INTO payments (id, app_id, order_id, status) VALUES (?, ?, ?, ?)').run(
    id,
    appId,
    orderId,
    status,
  );
}

describe('migration 0009 — partial unique index payments(app_id, order_id)', () => {
  it('duplikat order_id aktif dalam satu app → UNIQUE constraint', () => {
    const db = setup();
    insert(db, 'p1', 'a1', 'ORD-1', 'pending');
    expect(() => insert(db, 'p2', 'a1', 'ORD-1', 'success')).toThrow(/UNIQUE/);
  });

  it('baris expired tidak memblokir reuse order_id', () => {
    const db = setup();
    insert(db, 'p1', 'a1', 'ORD-1', 'expired');
    expect(() => insert(db, 'p2', 'a1', 'ORD-1', 'pending')).not.toThrow();
  });

  it('banyak baris expired dengan order_id sama → boleh', () => {
    const db = setup();
    insert(db, 'p1', 'a1', 'ORD-1', 'expired');
    expect(() => insert(db, 'p2', 'a1', 'ORD-1', 'expired')).not.toThrow();
  });

  it('order_id NULL bebas duplikat', () => {
    const db = setup();
    insert(db, 'p1', 'a1', null, 'pending');
    expect(() => insert(db, 'p2', 'a1', null, 'pending')).not.toThrow();
  });

  it('order_id sama di app berbeda → boleh', () => {
    const db = setup();
    insert(db, 'p1', 'a1', 'ORD-1', 'pending');
    expect(() => insert(db, 'p2', 'a2', 'ORD-1', 'pending')).not.toThrow();
  });
});
