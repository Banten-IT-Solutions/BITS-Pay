import { writable, derived } from 'svelte/store';
import { api } from '../lib/api';
import type { UserPublic } from '@bits-pay/shared';

interface AuthState {
  user: UserPublic | null;
  token: string | null;
  loading: boolean;
}

function createAuthStore() {
  const token = localStorage.getItem('token');
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    token,
    loading: !!token,
  });

  return {
    subscribe,
    async init() {
      const t = localStorage.getItem('token');
      if (!t) {
        update((s) => ({ ...s, loading: false }));
        return;
      }
      try {
        const user = await api.get<UserPublic>('/auth/me');
        update({ user, token: t, loading: false });
      } catch {
        localStorage.removeItem('token');
        update({ user: null, token: null, loading: false });
      }
    },
    async login(email: string, password: string) {
      const data = await api.post<{ token: string; user: UserPublic }>('/auth/login', {
        email,
        password,
      });
      localStorage.setItem('token', data.token);
      set({ user: data.user, token: data.token, loading: false });
    },
    async signup(name: string, email: string, password: string) {
      const data = await api.post<{ token: string; user: UserPublic }>('/auth/signup', {
        name,
        email,
        password,
      });
      localStorage.setItem('token', data.token);
      set({ user: data.user, token: data.token, loading: false });
    },
    logout() {
      localStorage.removeItem('token');
      set({ user: null, token: null, loading: false });
    },
  };
}

export const auth = createAuthStore();

export const isAuthenticated = derived(auth, ($auth) => !!$auth.token && !$auth.loading);
export const isAdmin = derived(auth, ($auth) => false);
