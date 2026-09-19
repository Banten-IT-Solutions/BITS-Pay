<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Table from '../components/ui/Table.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import { formatDateTime } from '../lib/format';
  import { formatAmount, type Payment } from '@bits-pay/shared';

  interface OverviewStats {
    total_payments: number;
    today_payments: number;
    pending_count: number;
    success_count: number;
  }

  let stats = $state<OverviewStats | null>(null);
  let recent = $state<Payment[]>([]);
  let loading = $state(true);
  let error = $state('');

  async function load() {
    loading = true;
    error = '';
    try {
      const [s, r] = await Promise.all([
        api.get<OverviewStats>('/app/payments/stats'),
        api.get<{ items: Payment[] }>('/app/payments?per_page=5'),
      ]);
      stats = s;
      recent = r.items;
    } catch (e) {
      error = (e as Error).message || 'Gagal memuat data';
    } finally {
      loading = false;
    }
  }

  onMount(load);

  const statDefs = $derived([
    { label: 'Total Transaksi', value: stats?.total_payments ?? 0, cls: 'text-text' },
    { label: 'Hari Ini', value: stats?.today_payments ?? 0, cls: 'text-text' },
    { label: 'Pending', value: stats?.pending_count ?? 0, cls: 'text-warning' },
    { label: 'Sukses', value: stats?.success_count ?? 0, cls: 'text-success' },
  ]);
</script>

{#if error}
  <ErrorState {error} onRetry={load} />
{:else}
  <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
    {#each statDefs as s (s.label)}
      <Card class="p-4 sm:p-5" padding={false}>
        {#if loading}
          <div class="skeleton mb-2.5 h-3 w-20"></div>
          <div class="skeleton h-8 w-16"></div>
        {:else}
          <p class="text-xs font-medium text-muted">{s.label}</p>
          <p class="num mt-1.5 text-2xl font-semibold sm:text-[28px] {s.cls}">{s.value}</p>
        {/if}
      </Card>
    {/each}
  </div>

  <div class="mt-5 sm:mt-6">
    <Card title="Transaksi Terbaru" padding={false} class="overflow-hidden">
      {#snippet actions()}
        <button
          class="text-[13px] font-semibold text-accent hover:text-accent-strong"
          onclick={() => push('/payments')}
        >
          Lihat semua →
        </button>
      {/snippet}
      {#if !loading && recent.length === 0}
        <EmptyState
          title="Belum ada transaksi"
          message="Transaksi QRIS yang masuk akan tampil di sini."
          icon="payments"
        />
      {:else}
        <Table headers={['Order ID', 'Jumlah', 'Status', 'Waktu']} {loading} loadingRows={5}>
          {#each recent as p (p.id)}
            <tr
              class="cursor-pointer transition-colors duration-150 hover:bg-surface-2/50"
              onclick={() => push(`/payments/${p.id}`)}
            >
              <td class="num px-4 py-3 text-xs first:pl-5">{p.order_id || '-'}</td>
              <td class="num px-4 py-3 font-medium">{formatAmount(p.amount)}</td>
              <td class="px-4 py-3"><Badge status={p.status} /></td>
              <td class="px-4 py-3 text-xs text-faint last:pr-5">{formatDateTime(p.created_at)}</td>
            </tr>
          {/each}
        </Table>
      {/if}
    </Card>
  </div>
{/if}
