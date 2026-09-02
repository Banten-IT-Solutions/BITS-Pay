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
    if (a === 100 && c >= 64 && c <= 127) return true; // CGNAT
    if (a === 192 && b === 0 && c === 0) return true;
    if (a >= 224) return true; // multicast/reserved
    return false;
  }
  // IPv6: block loopback/link-local/ULA; conservative for raw IPv6 hosts.
  if (h.includes(':')) {
    const stripped = h.replace(/^\[|\]$/g, '');
    if (stripped === '::1') return true;
    if (stripped.startsWith('fe80') || stripped.startsWith('fc') || stripped.startsWith('fd')) {
      return true;
    }
    return true;
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
