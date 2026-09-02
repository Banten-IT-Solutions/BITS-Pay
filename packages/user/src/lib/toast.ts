import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

const toasts = writable<ToastMessage[]>([]);
let idCounter = 0;

export function showToast(message: string, type: ToastType = 'success') {
  const id = ++idCounter;
  toasts.update((list) => [...list, { id, type, message }]);
  setTimeout(() => {
    toasts.update((list) => list.filter((t) => t.id !== id));
  }, 4000);
}

export const toastStore = toasts;
