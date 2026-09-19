<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Button from '../components/ui/Button.svelte';
  import Pagination from '../components/ui/Pagination.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import DataTable, { bodyCell, type TableHeader } from '../components/ui/DataTable.svelte';
  import type { Callback } from '@bits-pay/shared';

  interface CallbackPage {
    items: Callback[];
    total: number;
    page: number;
    per_page: number;
  }

  let data = $state<CallbackPage | null>(null);
  let loading = $state(true);
  let error = $state('');
  let statusFilter = $state('');
  let currentPage = $state(1);
  let retrying = $state<string | null>(null);

  const headers: TableHeader[] = [
    { label: 'Event' },
    { label: 'Status' },
    { label: 'Coba', align: 'right' },
    { label: 'Retry Berikut', class: 'hidden lg:table-cell' },
    { label: 'Error', class: 'hidden md:table-cell' },
    { label: 'Dibuat', class: 'hidden lg:table-cell' },
    { label: '', class: 'w-20' },
  ];

  const eventStyles: Record<string, string> = {
    'payment.success': 'bg-success/10 text-accent-600',
    'payment.failed': 'bg-error/10 text-error',
    'payment.expired': 'bg-neutral-200/70 text-neutral-600',
  };

  function errMsg(e: unknown): string {
    return e instanceof Error ? e.message : 'Terjadi kesalahan';
  }

  function fmt(v: string | null): string {
    return v ? new Date(v).toLocaleString('id-ID') : '-';
  }

  async function load(page = 1) {
    loading = true;
    error = '';
    currentPage = page;
    try {
      const qs = new URLSearchParams({ page: String(page), per_page: '20' });
      if (statusFilter) qs.set('status', statusFilter);
      data = await api.get<CallbackPage>(`/admin/callbacks?${qs}`);
    } catch (e) {
      error = errMsg(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => load());

  async function retry(id: string) {
    retrying = id;
    try {
      await api.post(`/admin/callbacks/${id}/retry`);
      showToast('Callback dijadwalkan ulang', 'success');
      await load(currentPage);
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      retrying = null;
    }
  }
</script>

<div class="mb-4 flex items-center justify-between gap-2">
  <p class="text-[13px] text-neutral-600">
    {#if data && !loading}
      <span class="num font-medium text-neutral-900">{data.total.toLocaleString('id-ID')}</span> callback
    {:else}
      Riwayat pengiriman webhook
    {/if}
  </p>
  <select class="input w-auto flex-none" aria-label="Filter status" bind:value={statusFilter} onchange={() => load()}>
    <option value="">Semua Status</option>
    <option value="pending">Pending</option>
    <option value="success">Sukses</option>
    <option value="failed">Gagal</option>
    <option value="dead">Dead</option>
  </select>
</div>

{#if error && !data}
  <ErrorState {error} onRetry={() => load()} />
{:else if data && data.items.length === 0 && !loading}
  <EmptyState message="Tidak ada callback." icon="callbacks" />
{:else}
  <Card padding={false}>
    <DataTable {headers} loading={loading && !data} stickyFirst>
      {#each data?.items ?? [] as c (c.id)}
        {@const h = headers}
        <tr class="transition-colors hover:bg-primary-50/50">
          <td class={bodyCell(h[0], 0, true)}>
            <span class="inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-medium whitespace-nowrap {eventStyles[c.event] || 'bg-neutral-200/70 text-neutral-600'}">
              {c.event}
            </span>
          </td>
          <td class={bodyCell(h[1], 1, true)}><Badge status={c.status} /></td>
          <td class="{bodyCell(h[2], 2, true)} num text-neutral-600">{c.attempt}/{c.max_attempts}</td>
          <td class="{bodyCell(h[3], 3, true)} num text-xs text-neutral-600">{fmt(c.next_retry_at)}</td>
          <td class="{bodyCell(h[4], 4, true)} max-w-56 truncate text-xs text-error" title={c.last_error || ''}>{c.last_error || '-'}</td>
          <td class="{bodyCell(h[5], 5, true)} num text-xs text-neutral-600">{fmt(c.created_at)}</td>
          <td class={bodyCell(h[6], 6, true)}>
            {#if c.status === 'failed' || c.status === 'dead'}
              <Button size="sm" variant="secondary" loading={retrying === c.id} onclick={() => retry(c.id)}>
                Retry
              </Button>
            {/if}
          </td>
        </tr>
      {/each}
    </DataTable>
    {#if data}
      <Pagination page={data.page} perPage={data.per_page} total={data.total} onPageChange={(p) => load(p)} />
    {/if}
  </Card>
{/if}
