<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Button from '../components/ui/Button.svelte';
  import Modal from '../components/ui/Modal.svelte';
  import Pagination from '../components/ui/Pagination.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import { showToast } from '../lib/toast';
  import type { Invoice, InvoiceStatus } from '@bits-pay/shared';

  interface InvoicePage {
    items: Invoice[];
    total: number;
    page: number;
    per_page: number;
  }

  interface InvoicePayResponse {
    id: string;
    payment_id: string;
    qr_image: string;
    amount_due: number;
    amount: number;
  }

  interface PaymentConfirmResponse {
    id: string;
    status: string;
    match_result: string;
    ocr_amount: number | null;
    ocr_confidence: number | null;
    paid_at: string | null;
    message?: string;
  }

  let data = $state<InvoicePage | null>(null);
  let loading = $state(true);
  let error = $state('');
  let currentPage = $state(1);

  let payModal = $state(false);
  let payData = $state<InvoicePayResponse | null>(null);
  let payingId = $state<string | null>(null);
  let payLoading = $state(false);

  let confirmLoading = $state(false);
  let confirmResult = $state<PaymentConfirmResponse | null>(null);
  let confirmError = $state('');

  async function load(page = 1) {
    loading = true;
    error = '';
    currentPage = page;
    try {
      const qs = new URLSearchParams({ page: String(page), per_page: '20' });
      data = await api.get<InvoicePage>(`/billing/invoices?${qs}`);
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => load());

  async function handlePay(invoice: Invoice) {
    payingId = invoice.id;
    payLoading = true;
    confirmError = '';
    confirmResult = null;
    try {
      const res = await api.post<InvoicePayResponse>(`/billing/invoices/${invoice.id}/pay`);
      payData = res;
      payModal = true;
    } catch (e: any) {
      showToast(e.message || 'Gagal memproses pembayaran', 'error');
    } finally {
      payLoading = false;
      payingId = null;
    }
  }

  async function handleConfirm(e: Event) {
    e.preventDefault();
    if (!payData) return;
    confirmLoading = true;
    confirmError = '';
    confirmResult = null;
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    formData.set('amount', String(payData.amount_due));
    try {
      const res = await api.upload<PaymentConfirmResponse>(`/v1/payments/${payData.payment_id}/confirm`, formData);
      confirmResult = res;
      showToast('Pembayaran berhasil dikonfirmasi', 'success');
      await load(currentPage);
    } catch (e: any) {
      confirmError = e.message || 'Gagal konfirmasi pembayaran';
    } finally {
      confirmLoading = false;
    }
  }

  const statusLabels: Record<InvoiceStatus, string> = {
    pending: 'Pending',
    paid: 'Lunas',
    expired: 'Kadaluwarsa',
    failed: 'Gagal',
  };
</script>

<div class="mb-4">
  <h2 class="text-xl font-semibold">Tagihan</h2>
</div>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={() => load()} />
{:else if data && data.items.length === 0}
  <EmptyState message="Tidak ada tagihan." />
{:else if data}
  <Card>
    <table class="w-full text-left text-sm">
      <thead class="border-b border-neutral-100">
        <tr>
          <th class="px-4 py-3 font-medium text-neutral-400">ID Tagihan</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Tier</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Jumlah</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Status</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Jatuh Tempo</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Aksi</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-neutral-100">
        {#each data.items as inv}
          <tr class="hover:bg-neutral-50">
            <td class="px-4 py-3 font-mono text-xs">{inv.id.slice(0, 8)}...</td>
            <td class="px-4 py-3 text-sm capitalize">
              {inv.tier === 'premium_monthly' ? 'Bulanan' : 'Tahunan'}
            </td>
            <td class="px-4 py-3">Rp {inv.amount.toLocaleString('id-ID')}</td>
            <td class="px-4 py-3"><Badge status={inv.status} /></td>
            <td class="px-4 py-3 text-neutral-400">{new Date(inv.due_at).toLocaleDateString('id-ID')}</td>
            <td class="px-4 py-3">
              {#if inv.status === 'pending'}
                <Button size="sm" loading={payLoading && payingId === inv.id} onclick={() => handlePay(inv)}>
                  Bayar
                </Button>
              {:else}
                <span class="text-sm text-neutral-400">{statusLabels[inv.status]}</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    <Pagination page={data.page} perPage={data.per_page} total={data.total} onPageChange={(p) => load(p)} />
  </Card>
{/if}

<Modal open={payModal} title="Bayar Tagihan" onClose={() => { payModal = false; confirmResult = null; }}>
  {#if payData && !confirmResult}
    <div class="flex flex-col items-center gap-4">
      <img src={payData.qr_image} alt="QRIS" class="w-64 rounded-lg border" />
      <div class="text-center">
        <p class="text-sm text-neutral-400">Total Pembayaran</p>
        <p class="text-2xl font-bold text-neutral-900">Rp {payData.amount_due.toLocaleString('id-ID')}</p>
        <p class="text-xs text-neutral-400">(termasuk kode unik)</p>
      </div>
      <form class="w-full space-y-4" onsubmit={handleConfirm}>
        <div>
          <label class="mb-1 block text-sm font-medium text-neutral-600">Upload Bukti Transfer</label>
          <input
            type="file"
            name="proof_image"
            accept="image/jpeg,image/png"
            required
            class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
        {#if confirmError}
          <p class="text-sm text-error">{confirmError}</p>
        {/if}
        <Button type="submit" block loading={confirmLoading}>
          Konfirmasi Pembayaran
        </Button>
      </form>
    </div>
  {:else if confirmResult}
    <div class="flex flex-col items-center gap-4 text-center">
      <div class="flex h-16 w-16 items-center justify-center rounded-full {confirmResult.status === 'success' ? 'bg-success/10' : 'bg-warning/15'}">
        <span class="text-2xl">{confirmResult.status === 'success' ? '&#10003;' : '&#9888;'}</span>
      </div>
      <p class="text-lg font-semibold">
        {confirmResult.status === 'success' ? 'Pembayaran Dikonfirmasi' : 'Menunggu Review'}
      </p>
      <p class="text-sm text-neutral-400">{confirmResult.message || 'Status: ' + confirmResult.status}</p>
      {#if confirmResult.ocr_amount}
        <p class="text-sm text-neutral-600">Terbaca: Rp {confirmResult.ocr_amount.toLocaleString('id-ID')}</p>
      {/if}
      {#if confirmResult.ocr_confidence}
        <p class="text-sm text-neutral-600">Akurasi OCR: {confirmResult.ocr_confidence}%</p>
      {/if}
    </div>
  {/if}
</Modal>