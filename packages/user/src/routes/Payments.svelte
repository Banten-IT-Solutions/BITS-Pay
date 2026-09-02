<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { payments } from '../stores/payment';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Pagination from '../components/ui/Pagination.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import type { PaymentStatus } from '@bits-pay/shared';

  let search = $state('');
  let statusFilter = $state('');
  let loading = $state(true);
  let error = $state('');

  async function load(page = 1) {
    loading = true;
    error = '';
    try {
      await payments.fetch({
        page,
        search: search || undefined,
        status: (statusFilter as PaymentStatus) || undefined,
      });
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(() => load());

  function handleSearch() {
    load(1);
  }
</script>

<div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <h2 class="text-xl font-semibold">Pembayaran</h2>
  <div class="flex gap-2">
    <input
      class="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
      placeholder="Cari order_id..."
      bind:value={search}
      onkeydown={(e) => e.key === 'Enter' && handleSearch()}
    />
    <select
      class="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
      bind:value={statusFilter}
      onchange={handleSearch}
    >
      <option value="">Semua status</option>
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
{:else if $payments.items.length === 0}
  <EmptyState message="Tidak ada transaksi ditemukan." />
{:else}
  <Card>
    <table class="w-full text-left text-sm">
      <thead class="border-b border-neutral-100">
        <tr>
          <th class="px-4 py-3 font-medium text-neutral-400">Order ID</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Amount</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Status</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Tanggal</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Aksi</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-neutral-100">
        {#each $payments.items as p}
          <tr class="hover:bg-neutral-50 cursor-pointer" onclick={() => push(`/payments/${p.id}`)}>
            <td class="px-4 py-3 font-mono text-xs">{p.order_id || '-'}</td>
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
    <Pagination page={$payments.page} perPage={$payments.perPage} total={$payments.total} onPageChange={(p) => load(p)} />
  </Card>
{/if}