<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import Card from '../components/ui/Card.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import type { AdminOverview } from '@bits-pay/shared';

  let data = $state<AdminOverview | null>(null);
  let loading = $state(true);
  let error = $state('');

  async function load() {
    loading = true;
    error = '';
    try {
      data = await api.get<AdminOverview>('/admin/overview');
    } catch (e) {
      error = (e as Error).message;
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
{:else if data}
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Card>
      <div class="text-center">
        <p class="text-sm text-neutral-400">Total User</p>
        <p class="text-3xl font-bold text-neutral-900">{data.total_users}</p>
      </div>
    </Card>
    <Card>
      <div class="text-center">
        <p class="text-sm text-neutral-400">Total Transaksi</p>
        <p class="text-3xl font-bold text-neutral-900">{data.total_payments}</p>
      </div>
    </Card>
    <Card>
      <div class="text-center">
        <p class="text-sm text-neutral-400">Total Revenue</p>
        <p class="text-3xl font-bold text-success">Rp {data.total_revenue.toLocaleString('id-ID')}</p>
      </div>
    </Card>
    <Card>
      <div class="text-center">
        <p class="text-sm text-neutral-400">Pending Review</p>
        <p class="text-3xl font-bold text-warning">{data.pending_review_count}</p>
      </div>
    </Card>
    <Card>
      <div class="text-center">
        <p class="text-sm text-neutral-400">Hari Ini</p>
        <p class="text-3xl font-bold text-neutral-900">{data.today_payments}</p>
      </div>
    </Card>
    <Card>
      <div class="text-center">
        <p class="text-sm text-neutral-400">Revenue Hari Ini</p>
        <p class="text-3xl font-bold text-success">Rp {data.today_revenue.toLocaleString('id-ID')}</p>
      </div>
    </Card>
    <Card>
      <div class="text-center">
        <p class="text-sm text-neutral-400">Langganan Aktif</p>
        <p class="text-3xl font-bold text-neutral-900">{data.active_subscriptions}</p>
      </div>
    </Card>
    <Card>
      <div class="text-center">
        <p class="text-sm text-neutral-400">Pertumbuhan User</p>
        <p class="text-3xl font-bold text-accent-500">{data.user_growth}%</p>
      </div>
    </Card>
  </div>
{/if}