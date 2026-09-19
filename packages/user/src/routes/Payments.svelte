<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { payments } from '../stores/payment';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Pagination from '../components/ui/Pagination.svelte';
  import Table from '../components/ui/Table.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import Icon from '../components/ui/Icon.svelte';
  import { formatDateTime } from '../lib/format';
  import { formatAmount, type PaymentStatus } from '@bits-pay/shared';

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

  const selectCls =
    'h-10 rounded-lg border border-border-strong bg-bg px-3 text-sm text-text transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none';
</script>

<div class="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-end">
  <div class="relative flex-1 sm:max-w-xs">
    <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint">
      <Icon name="search" size={16} />
    </span>
    <input
      class="{selectCls} w-full pl-9"
      placeholder="Cari order_id..."
      bind:value={search}
      onkeydown={(e) => e.key === 'Enter' && handleSearch()}
      aria-label="Cari order ID"
    />
  </div>
  <select
    class={selectCls}
    bind:value={statusFilter}
    onchange={handleSearch}
    aria-label="Filter status"
  >
    <option value="">Semua status</option>
    <option value="pending">Pending</option>
    <option value="success">Sukses</option>
    <option value="failed">Gagal</option>
    <option value="expired">Expired</option>
    <option value="pending_review">Review</option>
  </select>
</div>

{#if error}
  <ErrorState {error} onRetry={() => load()} />
{:else if !loading && $payments.items.length === 0}
  <EmptyState
    title="Tidak Ada Transaksi"
    message={search || statusFilter
      ? 'Tidak ada transaksi yang cocok dengan filter.'
      : 'Transaksi QRIS yang masuk akan tampil di sini.'}
    icon="payments"
  />
{:else}
  <Card padding={false} class="overflow-hidden">
    <Table headers={['Order ID', 'Jumlah', 'Status', 'Waktu', '']} {loading} stickyFirst>
      {#each $payments.items as p (p.id)}
        <tr
          class="cursor-pointer transition-colors duration-150 hover:bg-surface-2/50"
          onclick={() => push(`/payments/${p.id}`)}
        >
          <td class="num sticky left-0 bg-surface px-4 py-3 text-xs font-medium first:pl-5">
            {p.order_id || '-'}
          </td>
          <td class="num px-4 py-3 whitespace-nowrap">{formatAmount(p.amount)}</td>
          <td class="px-4 py-3"><Badge status={p.status} /></td>
          <td class="px-4 py-3 text-xs whitespace-nowrap text-faint">{formatDateTime(p.created_at)}</td>
          <td class="px-4 py-3 text-right last:pr-5">
            <span class="inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
              Detail
              <Icon name="chevron-right" size={14} />
            </span>
          </td>
        </tr>
      {/each}
    </Table>
    <Pagination
      page={$payments.page}
      perPage={$payments.perPage}
      total={$payments.total}
      onPageChange={(p) => load(p)}
    />
  </Card>
{/if}
