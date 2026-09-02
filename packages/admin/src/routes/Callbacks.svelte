<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Button from '../components/ui/Button.svelte';
  import Pagination from '../components/ui/Pagination.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
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

  const eventStyles: Record<string, string> = {
    'payment.success': 'bg-success/10 text-success',
    'payment.failed': 'bg-error/10 text-error',
    'payment.expired': 'bg-neutral-100 text-neutral-600',
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

<div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <h2 class="text-xl font-semibold">Callbacks</h2>
  <select
    class="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
    bind:value={statusFilter}
    onchange={() => load()}
  >
    <option value="">Semua Status</option>
    <option value="pending">Pending</option>
    <option value="success">Sukses</option>
    <option value="failed">Gagal</option>
    <option value="dead">Dead</option>
  </select>
</div>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={() => load()} />
{:else if data && data.items.length === 0}
  <EmptyState message="Tidak ada callback." />
{:else if data}
  <Card>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-neutral-100">
          <tr>
            <th class="px-4 py-3 font-medium text-neutral-400">Event</th>
            <th class="px-4 py-3 font-medium text-neutral-400">Status</th>
            <th class="px-4 py-3 font-medium text-neutral-400">Percobaan</th>
            <th class="px-4 py-3 font-medium text-neutral-400">Retry Berikut</th>
            <th class="px-4 py-3 font-medium text-neutral-400">Error</th>
            <th class="px-4 py-3 font-medium text-neutral-400">Dibuat</th>
            <th class="px-4 py-3 font-medium text-neutral-400">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-100">
          {#each data.items as c}
            <tr class="hover:bg-neutral-50">
              <td class="px-4 py-3">
                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {eventStyles[c.event] || 'bg-neutral-100 text-neutral-600'}">
                  {c.event}
                </span>
              </td>
              <td class="px-4 py-3"><Badge status={c.status} /></td>
              <td class="px-4 py-3 text-neutral-600">{c.attempt}/{c.max_attempts}</td>
              <td class="px-4 py-3 text-xs text-neutral-400">{fmt(c.next_retry_at)}</td>
              <td class="px-4 py-3 max-w-xs truncate text-xs text-error">{c.last_error || '-'}</td>
              <td class="px-4 py-3 text-neutral-400">{fmt(c.created_at)}</td>
              <td class="px-4 py-3">
                {#if c.status === 'failed' || c.status === 'dead'}
                  <Button size="sm" variant="secondary" loading={retrying === c.id} onclick={() => retry(c.id)}>
                    Retry
                  </Button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <Pagination page={data.page} perPage={data.per_page} total={data.total} onPageChange={(p) => load(p)} />
  </Card>
{/if}