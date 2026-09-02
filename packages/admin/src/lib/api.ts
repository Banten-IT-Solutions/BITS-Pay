import type { ApiResponse } from '@bits-pay/shared';

export const BASE_URL = import.meta.env.VITE_API_URL || 'https://api.pay.bits.co.id/v1';

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

  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  const json: ApiResponse<T> = await res.json();

  if (!res.ok || !json.success) {
    const err = 'error' in json ? json.error : { code: 'unknown', message: 'Unknown error' };
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
