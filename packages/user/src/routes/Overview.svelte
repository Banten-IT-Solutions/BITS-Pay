<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import type { Payment } from '@bits-pay/shared';

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
</script>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else}
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Card>
      <div class="text-center">
        <p class="text-sm text-neutral-400">Total Transaksi</p>
        <p class="text-3xl font-bold text-neutral-900">{stats?.total_payments ?? 0}</p>
      </div>
    </Card>
    <Card>
      <div class="text-center">
        <p class="text-sm text-neutral-400">Hari Ini</p>
        <p class="text-3xl font-bold text-neutral-900">{stats?.today_payments ?? 0}</p>
      </div>
    </Card>
    <Card>
      <div class="text-center">
        <p class="text-sm text-neutral-400">Pending</p>
        <p class="text-3xl font-bold text-warning">{stats?.pending_count ?? 0}</p>
      </div>
    </Card>
    <Card>
      <div class="text-center">
        <p class="text-sm text-neutral-400">Sukses</p>
        <p class="text-3xl font-bold text-success">{stats?.success_count ?? 0}</p>
      </div>
    </Card>
  </div>

  <div class="mt-6">
    <Card title="Transaksi Terbaru">
      {#if recent.length === 0}
        <EmptyState message="Belum ada transaksi." />
      {:else}
        <table class="w-full text-left text-sm">
          <thead class="border-b border-neutral-100">
            <tr>
              <th class="px-4 py-3 font-medium text-neutral-400">Order ID</th>
              <th class="px-4 py-3 font-medium text-neutral-400">Amount</th>
              <th class="px-4 py-3 font-medium text-neutral-400">Status</th>
              <th class="px-4 py-3 font-medium text-neutral-400">Tanggal</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100">
            {#each recent as p}
              <tr>
                <td class="px-4 py-3 font-mono text-xs">{p.order_id || '-'}</td>
                <td class="px-4 py-3">Rp {p.amount.toLocaleString('id-ID')}</td>
                <td class="px-4 py-3"><Badge status={p.status} /></td>
                <td class="px-4 py-3 text-neutral-400">{new Date(p.created_at).toLocaleDateString('id-ID')}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </Card>
  </div>
{/if}