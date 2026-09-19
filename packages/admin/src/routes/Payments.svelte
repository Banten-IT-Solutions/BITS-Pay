<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Icon from '../components/ui/Icon.svelte';
  import Pagination from '../components/ui/Pagination.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import DataTable, { bodyCell, type TableHeader } from '../components/ui/DataTable.svelte';
  import { formatAmount, type Payment } from '@bits-pay/shared';

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

  const headers: TableHeader[] = [
    { label: 'Order ID' },
    { label: 'User', class: 'hidden lg:table-cell' },
    { label: 'Amount', align: 'right' },
    { label: 'Status' },
    { label: 'Tanggal', class: 'hidden md:table-cell' },
    { label: '', class: 'w-10' },
  ];

  async function load(page = 1) {
    loading = true;
    error = '';
    currentPage = page;
    try {
      const qs = new URLSearchParams({ page: String(page), per_page: '20' });
      if (search) qs.set('search', search);
      if (statusFilter) qs.set('status', statusFilter);
      data = await api.get<PaymentPage>(`/admin/payments?${qs}`);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(() => load());
</script>

<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
  <p class="text-[13px] text-neutral-600">
    {#if data && !loading}
      <span class="num font-medium text-neutral-900">{data.total.toLocaleString('id-ID')}</span> transaksi
    {:else}
      Semua transaksi masuk
    {/if}
  </p>
  <div class="flex gap-2">
    <div class="relative flex-1 sm:w-56 sm:flex-none">
      <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
        <Icon name="search" size={15} />
      </span>
      <input
        class="input pl-9"
        placeholder="Cari order ID..."
        aria-label="Cari transaksi"
        bind:value={search}
        onkeydown={(e) => e.key === 'Enter' && load()}
      />
    </div>
    <select class="input w-auto flex-none" aria-label="Filter status" bind:value={statusFilter} onchange={() => load()}>
      <option value="">Semua</option>
      <option value="pending">Pending</option>
      <option value="success">Sukses</option>
      <option value="failed">Gagal</option>
      <option value="expired">Expired</option>
      <option value="pending_review">Review</option>
    </select>
  </div>
</div>

{#if error && !data}
  <ErrorState {error} onRetry={() => load()} />
{:else if data && data.items.length === 0 && !loading}
  <EmptyState message="Tidak ada transaksi yang cocok." icon="payments" />
{:else}
  <Card padding={false}>
    <DataTable {headers} loading={loading && !data} stickyFirst>
      {#each data?.items ?? [] as p (p.id)}
        {@const h = headers}
        <tr
          class="cursor-pointer transition-colors hover:bg-primary-50/50 focus-visible:bg-primary-50"
          tabindex="0"
          onclick={() => push(`/payments/${p.id}`)}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && push(`/payments/${p.id}`)}
        >
          <td class="{bodyCell(h[0], 0, true)} font-mono text-xs font-medium text-neutral-900">{p.order_id || '-'}</td>
          <td class="{bodyCell(h[1], 1, true)} font-mono text-xs text-neutral-600">{p.user_id?.slice(0, 8) || '-'}</td>
          <td class="{bodyCell(h[2], 2, true)} num font-medium text-neutral-900">{formatAmount(p.amount)}</td>
          <td class={bodyCell(h[3], 3, true)}><Badge status={p.status} /></td>
          <td class="{bodyCell(h[4], 4, true)} num text-xs text-neutral-600">{new Date(p.created_at).toLocaleDateString('id-ID')}</td>
          <td class={bodyCell(h[5], 5, true)}>
            <span class="text-neutral-400" aria-hidden="true"><Icon name="chevron-right" size={15} /></span>
            <span class="sr-only">Lihat detail {p.order_id}</span>
          </td>
        </tr>
      {/each}
    </DataTable>
    {#if data}
      <Pagination page={data.page} perPage={data.per_page} total={data.total} onPageChange={(p) => load(p)} />
    {/if}
  </Card>
{/if}
