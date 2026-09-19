import type { ApiResponse } from '@bits-pay/shared';

// VITE_API_URL wajib diisi saat build produksi. Fallback = host yang sama + port
// default API dev (7001), supaya akses via IP LAN tetap jalan tanpa edit .env.
export const BASE_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:7001`;

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, string[]>;

  constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  } catch {
    // Kegagalan jaringan (offline, server mati, CORS) — pesan ramah, bukan TypeError mentah.
    throw new ApiError(
      0,
      'network_error',
      'Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.',
    );
  }
  let json: ApiResponse<T>;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(
      res.status,
      'invalid_response',
      'Terjadi gangguan pada server. Coba beberapa saat lagi.',
    );
  }

  if (!res.ok || !json.success) {
    const err =
      'error' in json
        ? json.error
        : { code: 'unknown', message: 'Terjadi kesalahan. Silakan coba lagi.' };
    throw new ApiError(res.status, err.code, err.message, err.details);
  }

  return json.data;
}

export const api = {
  get<T>(endpoint: string) {
    return request<T>(endpoint, { method: 'GET' });
  },
  post<T>(endpoint: string, body?: unknown) {
    return request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  put<T>(endpoint: string, body?: unknown) {
    return request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  delete<T>(endpoint: string) {
    return request<T>(endpoint, { method: 'DELETE' });
  },
  upload<T>(endpoint: string, formData: FormData) {
    return request<T>(endpoint, {
      method: 'POST',
      body: formData,
    });
  },
};

/**
 * Ambil bukti transfer sebagai object URL (butuh header Authorization,
 * tidak bisa lewat <img src> polos).
 */
export async function proofUrl(id: string): Promise<string> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/admin/payments/${id}/proof`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, 'proof_load_failed', 'Gagal memuat bukti bayar');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
