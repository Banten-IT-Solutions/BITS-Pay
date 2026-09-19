<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import Card from '../components/ui/Card.svelte';
  import Pagination from '../components/ui/Pagination.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import DataTable, { bodyCell, type TableHeader } from '../components/ui/DataTable.svelte';
  import type { AuditLog } from '@bits-pay/shared';

  interface AuditLogPage {
    items: AuditLog[];
    total: number;
    page: number;
    per_page: number;
  }

  let data = $state<AuditLogPage | null>(null);
  let loading = $state(true);
  let error = $state('');
  let currentPage = $state(1);

  const headers: TableHeader[] = [
    { label: 'Aksi' },
    { label: 'Entitas' },
    { label: 'Detail', class: 'hidden md:table-cell' },
    { label: 'IP', class: 'hidden lg:table-cell' },
    { label: 'Waktu', class: 'hidden sm:table-cell' },
  ];

  function errMsg(e: unknown): string {
    return e instanceof Error ? e.message : 'Terjadi kesalahan';
  }

  async function load(page = 1) {
    loading = true;
    error = '';
    currentPage = page;
    try {
      const qs = new URLSearchParams({ page: String(page), per_page: '20' });
      data = await api.get<AuditLogPage>(`/admin/audit-logs?${qs}`);
    } catch (e) {
      error = errMsg(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => load());
</script>

<div class="mb-4">
  <p class="text-[13px] text-neutral-600">
    {#if data && !loading}
      <span class="num font-medium text-neutral-900">{data.total.toLocaleString('id-ID')}</span> jejak aktivitas
    {:else}
      Jejak aktivitas admin
    {/if}
  </p>
</div>

{#if error && !data}
  <ErrorState {error} onRetry={() => load()} />
{:else if data && data.items.length === 0 && !loading}
  <EmptyState message="Tidak ada audit log." icon="audit" />
{:else}
  <Card padding={false}>
    <DataTable {headers} loading={loading && !data} stickyFirst>
      {#each data?.items ?? [] as log (log.id)}
        {@const h = headers}
        <tr class="transition-colors hover:bg-primary-50/50">
          <td class="{bodyCell(h[0], 0, true)} font-medium whitespace-nowrap text-neutral-900">{log.action}</td>
          <td class={bodyCell(h[1], 1, true)}>
            <span class="font-mono text-xs text-neutral-900">{log.entity_type}</span>
            {#if log.entity_id}
              <span class="ml-1 font-mono text-xs text-neutral-400">#{log.entity_id.slice(0, 8)}</span>
            {/if}
          </td>
          <td class="{bodyCell(h[2], 2, true)} max-w-64 truncate text-neutral-600" title={log.detail || ''}>{log.detail || '-'}</td>
          <td class="{bodyCell(h[3], 3, true)} font-mono text-xs text-neutral-600">{log.ip_address || '-'}</td>
          <td class="{bodyCell(h[4], 4, true)} num text-xs whitespace-nowrap text-neutral-600">{new Date(log.created_at).toLocaleString('id-ID')}</td>
        </tr>
      {/each}
    </DataTable>
    {#if data}
      <Pagination page={data.page} perPage={data.per_page} total={data.total} onPageChange={(p) => load(p)} />
    {/if}
  </Card>
{/if}
