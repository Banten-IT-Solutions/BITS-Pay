<script lang="ts">
  import { onMount } from 'svelte';
  import { api, proofUrl } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Button from '../components/ui/Button.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import type { Payment } from '@bits-pay/shared';

  let items = $state<Payment[]>([]);
  let proofUrls = $state<Record<string, string>>({});
  let loading = $state(true);
  let error = $state('');

  async function load() {
    loading = true;
    error = '';
    try {
      const data = await api.get<{ items: Payment[]; page: number; per_page: number; total: number }>(
        '/admin/payments/review',
      );
      items = data.items;
      const urls: Record<string, string> = {};
      await Promise.all(
        data.items
          .filter((p) => p.proof_path)
          .map(async (p) => {
            try {
              urls[p.id] = await proofUrl(p.id);
            } catch {
              urls[p.id] = '';
            }
          }),
      );
      proofUrls = urls;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function handleAction(paymentId: string, action: 'confirm' | 'reject') {
    try {
      await api.post(`/admin/payments/${paymentId}/${action}`);
      showToast(`Transaksi ${action === 'confirm' ? 'dikonfirmasi' : 'ditolak'}`, 'success');
      items = items.filter((p) => p.id !== paymentId);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }
</script>

<div class="mb-4">
  <h2 class="text-xl font-semibold">Review Queue</h2>
  <p class="text-sm text-neutral-400">Transaksi yang perlu review manual</p>
</div>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else if items.length === 0}
  <EmptyState title="Tidak ada review" message="Semua transaksi sudah terverifikasi." />
{:else}
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    {#each items as p}
      <Card>
        <div class="mb-3 flex items-center justify-between">
          <Badge status="pending_review" />
          <span class="text-xs text-neutral-400 font-mono">{p.id.slice(0, 8)}...</span>
        </div>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-neutral-400">Order ID</span>
            <span class="font-mono">{p.order_id || '-'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-neutral-400">Amount</span>
            <span class="font-semibold">Rp {p.amount.toLocaleString('id-ID')}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-neutral-400">Amount Due</span>
            <span class="font-mono">{p.amount_due}</span>
          </div>
          {#if p.ocr_amount !== null}
            <div class="flex justify-between">
              <span class="text-neutral-400">OCR Terbaca</span>
              <span class="font-mono">{p.ocr_amount.toLocaleString('id-ID')}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-neutral-400">Confidence</span>
              <span>{p.ocr_confidence}%</span>
            </div>
          {/if}
        </div>
        {#if p.proof_path}
          <div class="my-3">
            {#if proofUrls[p.id]}
              <img src={proofUrls[p.id]} alt="Bukti transfer" class="w-full rounded-lg border border-neutral-100" />
            {:else}
              <p class="py-3 text-center text-sm text-neutral-400">Memuat bukti...</p>
            {/if}
          </div>
        {/if}
        <div class="mt-3 flex gap-2">
          <div class="flex-1"><Button variant="primary" block onclick={() => handleAction(p.id, 'confirm')}>Konfirmasi</Button></div>
          <div class="flex-1"><Button variant="danger" block onclick={() => handleAction(p.id, 'reject')}>Tolak</Button></div>
        </div>
      </Card>
    {/each}
  </div>
{/if}