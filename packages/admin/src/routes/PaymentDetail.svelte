<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
import { api, proofUrl } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Button from '../components/ui/Button.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import type { Payment } from '@bits-pay/shared';

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
      <div class="space-y-3 text-sm">
        <div class="flex justify-between">
          <span class="text-neutral-400">ID</span>
          <span class="font-mono text-xs">{payment.id}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-neutral-400">Order ID</span>
          <span class="font-mono text-xs">{payment.order_id || '-'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-neutral-400">Amount</span>
          <span class="font-semibold">Rp {payment.amount.toLocaleString('id-ID')}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-neutral-400">Amount Due</span>
          <span class="font-mono">{payment.amount_due}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-neutral-400">Status</span>
          <Badge status={payment.status} />
        </div>
        <div class="flex justify-between">
          <span class="text-neutral-400">User ID</span>
          <span class="text-xs text-neutral-400">{payment.user_id?.slice(0, 12) || '-'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-neutral-400">Dibuat</span>
          <span class="text-neutral-400">{new Date(payment.created_at).toLocaleString('id-ID')}</span>
        </div>
        {#if payment.paid_at}
          <div class="flex justify-between">
            <span class="text-neutral-400">Dibayar</span>
            <span class="text-neutral-400">{new Date(payment.paid_at).toLocaleString('id-ID')}</span>
          </div>
        {/if}
      </div>
    </Card>

    <Card title="QRIS & Bukti">
      {#if payment.qr_image}
        <div class="flex justify-center py-2">
          <img src={payment.qr_image} alt="QRIS" class="h-40 w-40" />
        </div>
      {/if}
      {#if payment.proof_path}
        <div class="mt-3">
          <p class="mb-1 text-xs font-medium text-neutral-400">Bukti Transfer</p>
          {#if proofUrlValue}
            <img src={proofUrlValue} alt="Bukti" class="w-full rounded-lg border border-neutral-100" />
          {:else}
            <p class="py-3 text-center text-sm text-neutral-400">Memuat bukti...</p>
          {/if}
        </div>
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
          {#if payment.ocr_raw_text}
            <div class="flex justify-between">
              <span class="text-neutral-400">Raw Text</span>
              <span class="font-mono text-xs">{payment.ocr_raw_text}</span>
            </div>
          {/if}
          {#if payment.match_result}
            <div class="flex justify-between">
              <span class="text-neutral-400">Match Result</span>
              <Badge status={payment.match_result === 'auto_confirm' || payment.match_result === 'manual_confirm' ? 'success' : payment.match_result === 'low_confidence' ? 'pending_review' : 'failed'} />
            </div>
          {/if}
        </div>
      </Card>
    </div>
  {/if}

  {#if payment.status === 'pending_review' || payment.status === 'pending'}
    <div class="mt-6 flex gap-3">
      <Button variant="primary" loading={acting} onclick={() => handleAction('confirm')}>Konfirmasi</Button>
      <Button variant="danger" loading={acting} onclick={() => handleAction('reject')}>Tolak</Button>
    </div>
  {/if}
{/if}