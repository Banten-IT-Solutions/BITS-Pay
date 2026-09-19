<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Button from '../components/ui/Button.svelte';
  import Modal from '../components/ui/Modal.svelte';
  import Pagination from '../components/ui/Pagination.svelte';
  import Table from '../components/ui/Table.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import Icon from '../components/ui/Icon.svelte';
  import { showToast } from '../lib/toast';
  import { formatDate } from '../lib/format';
  import { formatAmount, type Invoice, type InvoiceStatus } from '@bits-pay/shared';

  interface InvoicePage {
    items: Invoice[];
    total: number;
    page: number;
    per_page: number;
  }

  interface InvoicePayResponse {
    id: string;
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
    } catch (e) {
      error = (e as Error).message;
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
    } catch (e) {
      showToast((e as Error).message || 'Gagal memproses pembayaran', 'error');
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
      const res = await api.upload<PaymentConfirmResponse>(
        `/app/payments/${payData.id}/confirm`,
        formData,
      );
      confirmResult = res;
      showToast('Pembayaran berhasil dikonfirmasi', 'success');
      await load(currentPage);
    } catch (e) {
      confirmError = (e as Error).message || 'Gagal konfirmasi pembayaran';
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

{#if error}
  <ErrorState {error} onRetry={() => load()} />
{:else if !loading && data && data.items.length === 0}
  <EmptyState
    title="Tidak ada tagihan"
    message="Tagihan langganan premium akan muncul di sini."
    icon="invoices"
  />
{:else}
  <Card padding={false} class="overflow-hidden">
    <Table headers={['ID Tagihan', 'Tier', 'Jumlah', 'Status', 'Jatuh Tempo', '']} {loading}>
      {#each data?.items ?? [] as inv (inv.id)}
        <tr class="transition-colors duration-150 hover:bg-surface-2/50">
          <td class="num px-4 py-3 text-xs first:pl-5">{inv.id.slice(0, 8)}…</td>
          <td class="px-4 py-3 text-sm">
            {inv.tier === 'premium_monthly' ? 'Bulanan' : 'Tahunan'}
          </td>
          <td class="num px-4 py-3 whitespace-nowrap">{formatAmount(inv.amount)}</td>
          <td class="px-4 py-3"><Badge status={inv.status} /></td>
          <td class="px-4 py-3 text-xs whitespace-nowrap text-faint">{formatDate(inv.due_at)}</td>
          <td class="px-4 py-3 text-right last:pr-5">
            {#if inv.status === 'pending'}
              <Button size="sm" loading={payLoading && payingId === inv.id} onclick={() => handlePay(inv)}>
                Bayar
              </Button>
            {:else}
              <span class="text-xs text-faint">{statusLabels[inv.status]}</span>
            {/if}
          </td>
        </tr>
      {/each}
    </Table>
    {#if data}
      <Pagination
        page={data.page}
        perPage={data.per_page}
        total={data.total}
        onPageChange={(p) => load(p)}
      />
    {/if}
  </Card>
{/if}

<Modal
  open={payModal}
  title="Bayar Tagihan"
  onClose={() => {
    payModal = false;
    confirmResult = null;
  }}
>
  {#if payData && !confirmResult}
    <div class="flex flex-col items-center gap-4">
      <div class="rounded-lg border border-border bg-white p-4">
        <img src={payData.qr_image} alt="Kode QRIS tagihan" class="w-56 max-w-full" />
      </div>
      <div class="text-center">
        <p class="text-xs font-medium text-faint">Total Pembayaran</p>
        <p class="num mt-1 text-2xl font-semibold text-text">{formatAmount(payData.amount_due)}</p>
        <p class="mt-1 text-xs text-faint">(sudah termasuk kode unik)</p>
      </div>
      <form class="w-full space-y-4" onsubmit={handleConfirm}>
        <div>
          <label for="invoice-proof" class="mb-1.5 block text-[13px] font-medium text-muted">
            Upload Bukti Transfer
          </label>
          <input
            id="invoice-proof"
            type="file"
            name="proof_image"
            accept="image/jpeg,image/png"
            required
            class="w-full rounded-lg border border-border-strong bg-bg px-3 py-2.5 text-sm text-text file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-text focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none"
          />
        </div>
        {#if confirmError}
          <p class="text-sm text-error" role="alert">{confirmError}</p>
        {/if}
        <Button type="submit" block loading={confirmLoading}>Konfirmasi Pembayaran</Button>
      </form>
    </div>
  {:else if confirmResult}
    <div class="flex flex-col items-center gap-3 py-2 text-center">
      <div
        class="flex h-14 w-14 items-center justify-center rounded-full border {confirmResult.status ===
        'success'
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-warning/30 bg-warning/10 text-warning'}"
      >
        <Icon name={confirmResult.status === 'success' ? 'check' : 'clock'} size={26} />
      </div>
      <p class="text-lg font-semibold text-text">
        {confirmResult.status === 'success' ? 'Pembayaran Dikonfirmasi' : 'Menunggu Review'}
      </p>
      <p class="text-sm text-muted">
        {confirmResult.message || 'Status: ' + confirmResult.status}
      </p>
      {#if confirmResult.ocr_amount}
        <p class="text-sm text-muted">
          Terbaca: <span class="num">{formatAmount(confirmResult.ocr_amount)}</span>
        </p>
      {/if}
      {#if confirmResult.ocr_confidence}
        <p class="text-sm text-muted">
          Akurasi OCR: <span class="num">{confirmResult.ocr_confidence}%</span>
        </p>
      {/if}
    </div>
  {/if}
</Modal>
