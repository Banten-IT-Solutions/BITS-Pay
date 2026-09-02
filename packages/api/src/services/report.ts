import type { Env } from '../config';
import type { ReportDayRow } from '@bits-pay/shared';

interface ExportRow {
  id: string;
  order_id: string | null;
  amount: number;
  amount_due: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

const EXPORT_HEADER = ['id', 'order_id', 'amount', 'amount_due', 'status', 'created_at', 'paid_at'];

export class ReportService {
  static async transactions(env: Env, days = 30): Promise<ReportDayRow[]> {
    const { results } = await env.DB.prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS count,
              SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END) AS revenue
       FROM payments
       WHERE created_at >= datetime('now', ?)
       GROUP BY date(created_at)
       ORDER BY day ASC`,
    )
      .bind(`-${days} days`)
      .all<ReportDayRow>();
    return results ?? [];
  }

  static async exportCsv(env: Env, days = 30): Promise<string> {
    const { results } = await env.DB.prepare(
      `SELECT id, order_id, amount, amount_due, status, created_at, paid_at
       FROM payments
       WHERE created_at >= datetime('now', ?)
       ORDER BY created_at ASC`,
    )
      .bind(`-${days} days`)
      .all<ExportRow>();

    const lines: string[] = [EXPORT_HEADER.map(csvEscape).join(',')];
    for (const row of results ?? []) {
      lines.push(
        [
          csvEscape(row.id),
          csvEscape(row.order_id),
          csvEscape(row.amount),
          csvEscape(row.amount_due),
          csvEscape(row.status),
          csvEscape(row.created_at),
          csvEscape(row.paid_at),
        ].join(','),
      );
    }
    return `${lines.join('\n')}\n`;
  }
}

function csvEscape(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  // Cegah CSV formula injection (Excel/Sheets eksekusi =,+,-,@ atau tab/CR di awal sel).
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
