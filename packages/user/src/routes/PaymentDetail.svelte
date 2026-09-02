<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Button from '../components/ui/Button.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import type { Payment, PaymentConfirmResponse } from '@bits-pay/shared';

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
      payment = await api.get<Payment>(`/payments/${paymentId}`);
    } catch (e: any) {
      error = e.message;
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
      const result = await api.upload<PaymentConfirmResponse>(`/payments/${paymentId}/confirm`, fd);
      showToast(result.match_result === 'auto_confirm' ? 'Pembayaran dikonfirmasi!' : 'Menunggu review admin', 'success');
      payment!.status = result.status;
      payment!.match_result = result.match_result;
      payment!.ocr_amount = result.ocr_amount;
      payment!.ocr_confidence = result.ocr_confidence;
      selectedFile = null;
      userAmount = '';
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      uploading = false;
    }
  }
</script>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else if payment}
  <div class="mb-4">
    <button class="text-sm text-primary-500 hover:underline" onclick={() => push('/payments')}>&larr; Kembali</button>
  </div>

  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <Card title="Detail Transaksi">
      <div class="space-y-3">
        <div class="flex justify-between text-sm">
          <span class="text-neutral-400">ID</span>
          <span class="font-mono text-xs">{payment.id}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-neutral-400">Order ID</span>
          <span class="font-mono text-xs">{payment.order_id || '-'}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-neutral-400">Amount</span>
          <span class="font-semibold">Rp {payment.amount.toLocaleString('id-ID')}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-neutral-400">Amount Due</span>
          <span class="font-mono">{payment.amount_due}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-neutral-400">Kode Unik</span>
          <span class="font-mono">{payment.unique_code}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-neutral-400">Status</span>
          <Badge status={payment.status} />
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-neutral-400">Dibuat</span>
          <span class="text-neutral-400">{new Date(payment.created_at).toLocaleString('id-ID')}</span>
        </div>
        {#if payment.paid_at}
          <div class="flex justify-between text-sm">
            <span class="text-neutral-400">Dibayar</span>
            <span class="text-neutral-400">{new Date(payment.paid_at).toLocaleString('id-ID')}</span>
          </div>
        {/if}
      </div>
    </Card>

    <Card title="QRIS">
      {#if payment.qr_image}
        <div class="flex justify-center py-4">
          <img src={payment.qr_image} alt="QRIS" class="h-48 w-48" />
        </div>
      {:else}
        <p class="py-4 text-sm text-neutral-400">Belum ada QRIS.</p>
      {/if}
    </Card>
  </div>

  {#if payment.ocr_amount !== null}
    <div class="mt-6">
      <Card title="Hasil OCR">
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-neutral-400">Terbaca</span>
            <span class="font-mono">{payment.ocr_amount.toLocaleString('id-ID')}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-neutral-400">Confidence</span>
            <span>{payment.ocr_confidence}%</span>
          </div>
          {#if payment.match_result}
            <div class="flex justify-between">
              <span class="text-neutral-400">Hasil</span>
              <Badge status={payment.match_result === 'auto_confirm' || payment.match_result === 'manual_confirm' ? 'success' : payment.match_result === 'low_confidence' ? 'pending_review' : 'failed'} />
            </div>
          {/if}
        </div>
      </Card>
    </div>
  {/if}

  {#if payment.status === 'pending'}
    <div class="mt-6">
      <Card title="Konfirmasi Pembayaran">
        <form onsubmit={(e) => { e.preventDefault(); confirmPayment(); }} class="space-y-4">
          <div>
            <label class="mb-1 block text-sm font-medium text-neutral-600">Upload Bukti Transfer</label>
            <input type="file" accept="image/*" onchange={handleFile} class="w-full text-sm" required />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-neutral-600">Jumlah yang Dibayar</label>
            <input
              type="number"
              value={userAmount}
              oninput={(e) => userAmount = (e.target as HTMLInputElement).value}
              class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              placeholder="Contoh: 1500000001"
              required
            />
          </div>
          <Button type="submit" block loading={uploading}>Konfirmasi Pembayaran</Button>
        </form>
      </Card>
    </div>
  {/if}
{/if}