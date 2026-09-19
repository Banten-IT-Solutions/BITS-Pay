<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api, proofUrl } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Button from '../components/ui/Button.svelte';
  import Icon from '../components/ui/Icon.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import { formatAmount, type Payment } from '@bits-pay/shared';

  let { params } = $props();
  let paymentId = $derived(params?.id || '');

  let payment = $state<Payment | null>(null);
  let proofUrlValue = $state('');
  let loading = $state(true);
  let error = $state('');
  let acting = $state(false);

  async function load() {
    loading = true;
    error = '';
    try {
      payment = await api.get<Payment>(`/admin/payments/${paymentId}`);
      if (payment?.proof_path) {
        try {
          proofUrlValue = await proofUrl(payment.id);
        } catch {
          proofUrlValue = '';
        }
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function handleAction(action: 'confirm' | 'reject') {
    acting = true;
    try {
      const result = await api.post<Payment>(`/admin/payments/${paymentId}/${action}`);
      payment = result;
      showToast(`Transaksi ${action === 'confirm' ? 'dikonfirmasi' : 'ditolak'}`, 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      acting = false;
    }
  }

  function ocrMatch(p: Payment): boolean | null {
    if (p.ocr_amount === null) return null;
    return p.ocr_amount === p.amount_due;
  }
</script>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else if payment}
  <!-- Header: identitas transaksi + status -->
  <div class="mb-4">
    <button
      type="button"
      class="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-neutral-200/60 hover:text-neutral-900 sm:min-h-8"
      onclick={() => push('/payments')}
    >
      <Icon name="arrow-left" size={15} />
      Semua transaksi
    </button>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h2 class="font-mono text-lg font-semibold text-neutral-900">{payment.order_id || payment.id.slice(0, 8)}</h2>
      <Badge status={payment.status} />
    </div>
    <p class="num mt-1 text-xs text-neutral-600">
      Dibuat {new Date(payment.created_at).toLocaleString('id-ID')}
      {#if payment.paid_at}
        · Dibayar {new Date(payment.paid_at).toLocaleString('id-ID')}
      {/if}
    </p>
  </div>

  <!-- Ringkasan angka: strip terbagi -->
  <div class="mb-4 grid grid-cols-2 divide-neutral-200 rounded-xl border border-neutral-200 bg-white max-lg:gap-px max-lg:bg-neutral-200 lg:grid-cols-4 lg:divide-x">
    <div class="p-4 max-lg:rounded-xl max-lg:bg-white">
      <p class="font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">Amount</p>
      <p class="num mt-1.5 text-lg font-semibold text-neutral-900">{formatAmount(payment.amount)}</p>
    </div>
    <div class="p-4 max-lg:rounded-xl max-lg:bg-white">
      <p class="font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">Amount Due</p>
      <p class="num mt-1.5 text-lg font-semibold text-neutral-900">{formatAmount(payment.amount_due)}</p>
    </div>
    <div class="p-4 max-lg:rounded-xl max-lg:bg-white">
      <p class="font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">Kode Unik</p>
      <p class="num mt-1.5 text-lg font-semibold text-neutral-900">{String(payment.unique_code).padStart(3, '0')}</p>
    </div>
    <div class="p-4 max-lg:rounded-xl max-lg:bg-white">
      <p class="font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">OCR Terbaca</p>
      <p class="num mt-1.5 text-lg font-semibold {ocrMatch(payment) === false ? 'text-error' : ocrMatch(payment) ? 'text-accent-600' : 'text-neutral-900'}">
        {payment.ocr_amount !== null ? formatAmount(payment.ocr_amount) : '-'}
      </p>
    </div>
  </div>

  <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
    <Card title="Detail Transaksi">
      <dl class="space-y-2.5 text-[13px]">
        <div class="flex items-baseline justify-between gap-3">
          <dt class="flex-none text-neutral-600">ID</dt>
          <dd class="truncate font-mono text-xs text-neutral-900">{payment.id}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-3">
          <dt class="flex-none text-neutral-600">Order ID</dt>
          <dd class="truncate font-mono text-xs text-neutral-900">{payment.order_id || '-'}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-3">
          <dt class="flex-none text-neutral-600">Status</dt>
          <dd><Badge status={payment.status} /></dd>
        </div>
        <div class="flex items-baseline justify-between gap-3">
          <dt class="flex-none text-neutral-600">User ID</dt>
          <dd class="truncate font-mono text-xs text-neutral-600">{payment.user_id || '-'}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-3">
          <dt class="flex-none text-neutral-600">Dibuat</dt>
          <dd class="num text-xs text-neutral-600">{new Date(payment.created_at).toLocaleString('id-ID')}</dd>
        </div>
        {#if payment.paid_at}
          <div class="flex items-baseline justify-between gap-3">
            <dt class="flex-none text-neutral-600">Dibayar</dt>
            <dd class="num text-xs text-neutral-600">{new Date(payment.paid_at).toLocaleString('id-ID')}</dd>
          </div>
        {/if}
      </dl>
    </Card>

    <Card title="QRIS & Bukti">
      {#if payment.qr_image}
        <div class="flex justify-center rounded-lg border border-neutral-100 bg-neutral-50 py-4">
          <img src={payment.qr_image} alt="Kode QRIS transaksi" class="h-40 w-40" />
        </div>
      {/if}
      {#if payment.proof_path}
        <div class={payment.qr_image ? 'mt-4' : ''}>
          <p class="label mb-2">Bukti Transfer</p>
          {#if proofUrlValue}
            <a href={proofUrlValue} target="_blank" rel="noopener" aria-label="Buka bukti transfer ukuran penuh">
              <img src={proofUrlValue} alt="Bukti transfer" class="max-h-80 w-full rounded-lg border border-neutral-200 object-contain transition-opacity hover:opacity-90" />
            </a>
          {:else}
            <div class="flex h-32 items-center justify-center rounded-lg border border-dashed border-neutral-200 text-neutral-400">
              <Icon name="image" size={20} />
            </div>
          {/if}
        </div>
      {/if}
      {#if !payment.qr_image && !payment.proof_path}
        <p class="py-3 text-center text-[13px] text-neutral-600">Tidak ada lampiran.</p>
      {/if}
    </Card>
  </div>

  {#if payment.ocr_amount !== null}
    <div class="mt-4">
      <Card title="Hasil OCR" subtitle="Pembacaan otomatis bukti transfer">
        <div class="mb-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium {ocrMatch(payment) ? 'bg-success/10 text-accent-600' : 'bg-error/10 text-error'}">
          <Icon name={ocrMatch(payment) ? 'check' : 'alert'} size={15} />
          {ocrMatch(payment) ? 'Nominal cocok dengan amount due' : 'Nominal tidak cocok dengan amount due'}
        </div>
        <dl class="space-y-2.5 text-[13px]">
          <div class="flex items-baseline justify-between gap-3">
            <dt class="flex-none text-neutral-600">Terbaca</dt>
            <dd class="num font-medium text-neutral-900">{formatAmount(payment.ocr_amount)}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <dt class="flex-none text-neutral-600">Confidence</dt>
            <dd class="num text-neutral-900">{payment.ocr_confidence}%</dd>
          </div>
          {#if payment.ocr_raw_text}
            <div class="flex items-baseline justify-between gap-3">
              <dt class="flex-none text-neutral-600">Raw Text</dt>
              <dd class="truncate font-mono text-xs text-neutral-600" title={payment.ocr_raw_text}>{payment.ocr_raw_text}</dd>
            </div>
          {/if}
          {#if payment.match_result}
            <div class="flex items-baseline justify-between gap-3">
              <dt class="flex-none text-neutral-600">Match Result</dt>
              <dd><Badge status={payment.match_result === 'auto_confirm' || payment.match_result === 'manual_confirm' ? 'success' : payment.match_result === 'low_confidence' ? 'pending_review' : 'failed'} /></dd>
            </div>
          {/if}
        </dl>
      </Card>
    </div>
  {/if}

  {#if payment.status === 'pending_review' || payment.status === 'pending'}
    <div class="mt-4 flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:justify-end">
      <Button variant="danger" loading={acting} onclick={() => handleAction('reject')}>
        <Icon name="x" size={15} />
        Tolak
      </Button>
      <Button variant="primary" loading={acting} onclick={() => handleAction('confirm')}>
        <Icon name="check" size={15} />
        Konfirmasi
      </Button>
    </div>
  {/if}
{/if}
