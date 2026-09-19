<script lang="ts">
  import { onMount } from 'svelte';
  import { api, proofUrl } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Button from '../components/ui/Button.svelte';
  import Icon from '../components/ui/Icon.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import { formatAmount, type Payment } from '@bits-pay/shared';

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
    } catch (e) {
      error = (e as Error).message;
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
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  function ocrMatch(p: Payment): boolean | null {
    if (p.ocr_amount === null) return null;
    return p.ocr_amount === p.amount_due;
  }
</script>

<div class="mb-4">
  <p class="text-[13px] text-neutral-600">
    {#if !loading && !error}
      <span class="num font-medium text-neutral-900">{items.length}</span> transaksi perlu dicek manual
    {:else}
      Transaksi yang perlu review manual
    {/if}
  </p>
</div>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else if items.length === 0}
  <EmptyState title="Antrean Bersih" message="Semua transaksi sudah terverifikasi. Tidak ada yang menunggu review." icon="check" />
{:else}
  <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
    {#each items as p (p.id)}
      <Card padding={false}>
        <!-- Header kartu: identitas + waktu -->
        <div class="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
          <div class="flex min-w-0 items-center gap-2.5">
            <Badge status="pending_review" />
            <span class="truncate font-mono text-xs text-neutral-600" title={p.id}>#{p.id.slice(0, 8)}</span>
          </div>
          <span class="num flex-none text-xs text-neutral-600">{new Date(p.created_at).toLocaleString('id-ID')}</span>
        </div>

        <div class="grid gap-4 p-5 {p.proof_path ? 'sm:grid-cols-[180px_1fr]' : ''}">
          <!-- Bukti transfer -->
          {#if p.proof_path}
            <div>
              {#if proofUrls[p.id]}
                <a href={proofUrls[p.id]} target="_blank" rel="noopener" aria-label="Buka bukti transfer ukuran penuh">
                  <img
                    src={proofUrls[p.id]}
                    alt="Bukti transfer {p.order_id || p.id}"
                    class="max-h-56 w-full rounded-lg border border-neutral-200 object-cover object-top transition-opacity hover:opacity-90"
                  />
                </a>
              {:else}
                <div class="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-200 text-neutral-400">
                  <Icon name="image" size={20} />
                </div>
              {/if}
            </div>
          {/if}

          <!-- Fakta transaksi -->
          <dl class="space-y-2 text-[13px]">
            <div class="flex items-baseline justify-between gap-3">
              <dt class="flex-none text-neutral-600">Order ID</dt>
              <dd class="truncate font-mono text-xs font-medium text-neutral-900">{p.order_id || '-'}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="flex-none text-neutral-600">Amount</dt>
              <dd class="num font-medium text-neutral-900">{formatAmount(p.amount)}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="flex-none text-neutral-600">Amount Due</dt>
              <dd class="num font-semibold text-neutral-900">{formatAmount(p.amount_due)}</dd>
            </div>
            {#if p.ocr_amount !== null}
              <div class="mt-1 rounded-lg bg-neutral-50 p-2.5">
                <div class="flex items-baseline justify-between gap-3">
                  <dt class="flex-none text-neutral-600">OCR Terbaca</dt>
                  <dd class="num font-medium {ocrMatch(p) ? 'text-accent-600' : 'text-error'}">{formatAmount(p.ocr_amount)}</dd>
                </div>
                <div class="mt-1.5 flex items-center justify-between gap-3">
                  <dt class="flex-none text-neutral-600">Confidence</dt>
                  <dd class="num text-neutral-900">{p.ocr_confidence}%</dd>
                </div>
                <div class="mt-2 flex items-center gap-1.5 text-xs font-medium {ocrMatch(p) ? 'text-accent-600' : 'text-error'}">
                  <Icon name={ocrMatch(p) ? 'check' : 'alert'} size={13} />
                  {ocrMatch(p) ? 'Nominal cocok dengan amount due' : 'Nominal tidak cocok — cek bukti baik-baik'}
                </div>
              </div>
            {/if}
          </dl>
        </div>

        <!-- Aksi reviewer -->
        <div class="flex gap-2 border-t border-neutral-100 px-5 py-3">
          <Button variant="primary" block onclick={() => handleAction(p.id, 'confirm')}>
            <Icon name="check" size={15} />
            Konfirmasi
          </Button>
          <Button variant="danger" block onclick={() => handleAction(p.id, 'reject')}>
            <Icon name="x" size={15} />
            Tolak
          </Button>
        </div>
      </Card>
    {/each}
  </div>
{/if}
