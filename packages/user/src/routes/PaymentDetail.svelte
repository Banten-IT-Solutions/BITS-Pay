<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Button from '../components/ui/Button.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import Icon from '../components/ui/Icon.svelte';
  import { formatDateTime } from '../lib/format';
  import { formatAmount, type Payment, type PaymentConfirmResponse } from '@bits-pay/shared';

  let { params } = $props();
  let paymentId = $derived(params?.id || '');

  let payment = $state<Payment | null>(null);
  let loading = $state(true);
  let error = $state('');
  let uploading = $state(false);
  let selectedFile = $state<File | null>(null);
  let userAmount = $state('');

  async function load() {
    loading = true;
    error = '';
    try {
      payment = await api.get<Payment>(`/app/payments/${paymentId}`);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function handleFile(e: Event) {
    const input = e.target as HTMLInputElement;
    selectedFile = input.files?.[0] || null;
  }

  async function confirmPayment() {
    if (!selectedFile || !userAmount) return;
    uploading = true;
    try {
      const fd = new FormData();
      fd.append('proof_image', selectedFile);
      fd.append('amount', userAmount);
      const result = await api.upload<PaymentConfirmResponse>(
        `/app/payments/${paymentId}/confirm`,
        fd,
      );
      showToast(
        result.match_result === 'auto_confirm'
          ? 'Pembayaran dikonfirmasi!'
          : 'Menunggu review admin',
        'success',
      );
      payment!.status = result.status;
      payment!.match_result = result.match_result;
      payment!.ocr_amount = result.ocr_amount;
      payment!.ocr_confidence = result.ocr_confidence;
      selectedFile = null;
      userAmount = '';
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      uploading = false;
    }
  }

  interface TimelineItem {
    label: string;
    at: string;
    tone: 'neutral' | 'success' | 'warning' | 'error';
  }

  let timeline = $derived.by<TimelineItem[]>(() => {
    if (!payment) return [];
    const items: TimelineItem[] = [
      { label: 'Transaksi dibuat', at: payment.created_at, tone: 'neutral' },
    ];
    if (payment.status === 'expired' && payment.expired_at) {
      items.push({ label: 'Kedaluwarsa', at: payment.expired_at, tone: 'error' });
    }
    if (payment.paid_at) {
      items.push({ label: 'Pembayaran diterima', at: payment.paid_at, tone: 'success' });
    }
    if (payment.confirmed_at) {
      items.push({ label: 'Dikonfirmasi', at: payment.confirmed_at, tone: 'success' });
    }
    if (payment.status === 'failed') {
      items.push({ label: 'Gagal', at: payment.updated_at, tone: 'error' });
    }
    if (payment.status === 'pending_review') {
      items.push({ label: 'Menunggu review admin', at: payment.updated_at, tone: 'warning' });
    }
    return items;
  });

  const toneCls: Record<TimelineItem['tone'], string> = {
    neutral: 'bg-faint',
    success: 'bg-success',
    warning: 'bg-warning',
    error: 'bg-error',
  };

  const inputCls =
    'h-10 w-full rounded-lg border border-border-strong bg-bg px-3 text-sm text-text transition-[border-color,box-shadow] duration-150 placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none';
</script>

{#if loading}
  <div class="space-y-4">
    <div class="skeleton h-5 w-32"></div>
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div class="skeleton h-72"></div>
      <div class="skeleton h-72"></div>
    </div>
  </div>
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else if payment}
  <div class="mb-4">
    <button
      class="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
      onclick={() => push('/payments')}
    >
      <Icon name="arrow-left" size={16} />
      Pembayaran
    </button>
  </div>

  <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
    <div class="min-w-0 space-y-4">
      <Card>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-medium text-faint">Order ID</p>
            <p class="num mt-0.5 truncate text-sm font-medium text-text">
              {payment.order_id || '-'}
            </p>
          </div>
          <Badge status={payment.status} />
        </div>
        <div class="mt-4 border-t border-dashed border-border pt-4">
          <p class="text-xs font-medium text-faint">Total dibayar</p>
          <p class="num mt-1 text-[28px] leading-none font-semibold text-text sm:text-[32px]">
            {formatAmount(payment.amount_due)}
          </p>
          <p class="mt-1.5 text-xs text-faint">
            {formatAmount(payment.amount)} + kode unik
            <span class="num">{String(payment.unique_code).padStart(3, '0')}</span>
          </p>
        </div>
        <dl class="mt-4 space-y-2.5 border-t border-dashed border-border pt-4 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-faint">ID Transaksi</dt>
            <dd class="num max-w-[60%] truncate text-xs text-muted">{payment.id}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-faint">Dibuat</dt>
            <dd class="text-muted">{formatDateTime(payment.created_at)}</dd>
          </div>
          {#if payment.expired_at}
            <div class="flex items-center justify-between gap-3">
              <dt class="text-faint">Kedaluwarsa</dt>
              <dd class="text-muted">{formatDateTime(payment.expired_at)}</dd>
            </div>
          {/if}
          {#if payment.description}
            <div class="flex items-center justify-between gap-3">
              <dt class="text-faint">Deskripsi</dt>
              <dd class="max-w-[60%] truncate text-muted">{payment.description}</dd>
            </div>
          {/if}
        </dl>
      </Card>

      {#if payment.ocr_amount !== null}
        <Card title="Hasil OCR">
          <dl class="space-y-2.5 text-sm">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-faint">Nominal terbaca</dt>
              <dd class="num font-medium">{formatAmount(payment.ocr_amount)}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-faint">Confidence</dt>
              <dd class="num">{payment.ocr_confidence}%</dd>
            </div>
            {#if payment.match_result}
              <div class="flex items-center justify-between gap-3">
                <dt class="text-faint">Hasil pencocokan</dt>
                <dd>
                  <Badge
                    status={payment.match_result === 'auto_confirm' ||
                    payment.match_result === 'manual_confirm'
                      ? 'success'
                      : payment.match_result === 'low_confidence'
                        ? 'pending_review'
                        : 'failed'}
                  />
                </dd>
              </div>
            {/if}
          </dl>
        </Card>
      {/if}

      {#if payment.status === 'pending'}
        <Card title="Konfirmasi Pembayaran" subtitle="Upload bukti transfer untuk konfirmasi otomatis via OCR.">
          <form
            onsubmit={(e) => {
              e.preventDefault();
              confirmPayment();
            }}
            class="space-y-4"
          >
            <div>
              <label for="proof-file" class="mb-1.5 block text-[13px] font-medium text-muted">
                Bukti Transfer
              </label>
              <input
                id="proof-file"
                type="file"
                accept="image/*"
                onchange={handleFile}
                class="{inputCls} h-auto py-2.5 file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-text"
                required
              />
            </div>
            <div>
              <label for="payment-amount" class="mb-1.5 block text-[13px] font-medium text-muted">
                Jumlah yang Dibayar
              </label>
              <input
                id="payment-amount"
                type="number"
                value={userAmount}
                oninput={(e) => (userAmount = (e.target as HTMLInputElement).value)}
                class="{inputCls} num"
                placeholder="Contoh: 150001"
                required
              />
              <p class="mt-1.5 text-xs text-faint">
                Masukkan nominal persis seperti di aplikasi pembayaran (termasuk kode unik).
              </p>
            </div>
            <Button type="submit" block loading={uploading}>Konfirmasi Pembayaran</Button>
          </form>
        </Card>
      {/if}
    </div>

    <div class="min-w-0 space-y-4">
      <Card title="QRIS">
        {#if payment.qr_image}
          <!-- Sticker selalu putih seperti cetakan QRIS, di kedua tema. -->
          <div class="rounded-lg border border-border bg-white p-4">
            <img
              src={payment.qr_image}
              alt="Kode QRIS untuk pembayaran ini"
              class="mx-auto w-full max-w-[240px]"
            />
          </div>
        {:else}
          <p class="py-2 text-sm text-faint">QRIS tidak tersedia untuk transaksi ini.</p>
        {/if}
      </Card>

      <Card title="Riwayat Status">
        <ol class="relative ml-1.5 space-y-4 border-l border-border pl-5">
          {#each timeline as item, i (i)}
            <li class="relative">
              <span
                class="absolute top-[7px] -left-[23px] h-2 w-2 rounded-full ring-4 ring-surface {toneCls[item.tone]}"
                aria-hidden="true"
              ></span>
              <p class="text-sm font-medium text-text">{item.label}</p>
              <p class="mt-0.5 text-xs text-faint">{formatDateTime(item.at)}</p>
            </li>
          {/each}
        </ol>
      </Card>
    </div>
  </div>
{/if}
