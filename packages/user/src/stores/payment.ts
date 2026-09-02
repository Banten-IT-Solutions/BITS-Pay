import { writable } from 'svelte/store';
import { api } from '../lib/api';
import type { Payment, PaymentFilterParams } from '@bits-pay/shared';

interface PaymentListState {
  items: Payment[];
  total: number;
  page: number;
  perPage: number;
  loading: boolean;
}

function createPaymentStore() {
  const { subscribe, set } = writable<PaymentListState>({
    items: [],
    total: 0,
    page: 1,
    perPage: 20,
    loading: false,
  });

  return {
    subscribe,
    async fetch(params: PaymentFilterParams = {}) {
      set({
        items: [],
        total: 0,
        page: params.page || 1,
        perPage: params.per_page || 20,
        loading: true,
      });
      const qs = new URLSearchParams();
      if (params.page) qs.set('page', String(params.page));
      if (params.per_page) qs.set('per_page', String(params.per_page));
      if (params.status) qs.set('status', params.status);
      if (params.search) qs.set('search', params.search);
      if (params.start_date) qs.set('start_date', params.start_date);
      if (params.end_date) qs.set('end_date', params.end_date);
      const data = await api.get<{ items: Payment[]; total: number }>(`/payments?${qs.toString()}`);
      set({
        items: data.items,
        total: data.total,
        page: params.page || 1,
        perPage: params.per_page || 20,
        loading: false,
      });
    },
  };
}

export const payments = createPaymentStore();
