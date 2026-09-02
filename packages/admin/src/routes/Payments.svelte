<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Pagination from '../components/ui/Pagination.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import type { Payment, PaymentStatus } from '@bits-pay/shared';

  interface PaymentPage {
    items: Payment[];
    total: number;
    page: number;
    per_page: number;
  }

  let data = $state<PaymentPage | null>(null);
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let statusFilter = $state('');
  let currentPage = $state(1);

  async function load(page = 1) {
    loading = true;
    error = '';
    currentPage = page;
    try {
      const qs = new URLSearchParams({ page: String(page), per_page: '20' });
      if (search) qs.set('search', search);
      if (statusFilter) qs.set('status', statusFilter);
      data = await api.get<PaymentPage>(`/admin/payments?${qs}`);
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => load());
</script>

<div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <h2 class="text-xl font-semibold">Semua Transaksi</h2>
  <div class="flex gap-2">
    <input
      class="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
      placeholder="Cari..."
      bind:value={search}
      onkeydown={(e) => e.key === 'Enter' && load()}
    />
    <select
      class="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
      bind:value={statusFilter}
      onchange={() => load()}
    >
      <option value="">Semua</option>
      <option value="pending">Pending</option>
      <option value="success">Sukses</option>
      <option value="failed">Gagal</option>
      <option value="expired">Expired</option>
      <option value="pending_review">Review</option>
    </select>
  </div>
</div>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={() => load()} />
{:else if data && data.items.length === 0}
  <EmptyState message="Tidak ada transaksi." />
{:else if data}
  <Card>
    <table class="w-full text-left text-sm">
      <thead class="border-b border-neutral-100">
        <tr>
          <th class="px-4 py-3 font-medium text-neutral-400">Order ID</th>
          <th class="px-4 py-3 font-medium text-neutral-400">User</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Amount</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Status</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Tanggal</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Aksi</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-neutral-100">
        {#each data.items as p}
          <tr class="hover:bg-neutral-50">
            <td class="px-4 py-3 font-mono text-xs">{p.order_id || '-'}</td>
            <td class="px-4 py-3 text-xs text-neutral-400">{p.user_id?.slice(0, 8) || '-'}</td>
            <td class="px-4 py-3">Rp {p.amount.toLocaleString('id-ID')}</td>
            <td class="px-4 py-3"><Badge status={p.status} /></td>
            <td class="px-4 py-3 text-neutral-400">{new Date(p.created_at).toLocaleDateString('id-ID')}</td>
            <td class="px-4 py-3">
              <button class="text-sm text-primary-500 hover:underline" onclick={() => push(`/payments/${p.id}`)}>Detail</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    <Pagination page={data.page} perPage={data.per_page} total={data.total} onPageChange={(p) => load(p)} />
  </Card>
{/if}