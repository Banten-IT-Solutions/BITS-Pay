import { AppError } from './errors';

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b, c] = ipv4.slice(1).map((n) => Number(n));
    if (a === 10 || a === 0) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a === 192 && b === 0 && c === 0) return true;
    if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 (TEST-NET-1)
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 (benchmark)
    if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 (TEST-NET-2)
    if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 (TEST-NET-3)
    if (a === 255 && b === 255 && c === 255) return true; // broadcast
    if (a >= 224) return true; // multicast/reserved
    return false;
  }
  // IPv6: block unspecified/loopback/link-local/ULA saja; IPv6 publik tetap boleh.
  if (h.includes(':')) {
    const stripped = h.replace(/^\[|\]$/g, '');
    if (stripped === '::' || stripped === '::1') return true;
    if (/^fe[89ab]/.test(stripped)) return true; // fe80::/10 link-local
    if (stripped.startsWith('fc') || stripped.startsWith('fd')) return true; // fc00::/7 ULA
    return false;
  }
  return false;
}

/**
 * Validasi URL yang akan di-fetch oleh Worker (webhook callback).
 * Hanya https + host publik. Cegah SSRF ke loopback/private/link-local/metadata.
 */
export function validateCallbackUrl(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw AppError.badRequest('invalid_url', 'URL callback tidak valid');
  }
  if (url.protocol !== 'https:') {
    throw AppError.badRequest('invalid_url', 'URL callback harus https');
  }
  if (isPrivateHostname(url.hostname)) {
    throw AppError.badRequest('invalid_url', 'URL callback tidak boleh ke jaringan internal');
  }
}
