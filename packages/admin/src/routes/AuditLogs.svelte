<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import Card from '../components/ui/Card.svelte';
  import Pagination from '../components/ui/Pagination.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
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
  <h2 class="text-xl font-semibold">Audit Logs</h2>
</div>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={() => load()} />
{:else if data && data.items.length === 0}
  <EmptyState message="Tidak ada audit log." />
{:else if data}
  <Card>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-neutral-100">
          <tr>
            <th class="px-4 py-3 font-medium text-neutral-400">Aksi</th>
            <th class="px-4 py-3 font-medium text-neutral-400">Entitas</th>
            <th class="px-4 py-3 font-medium text-neutral-400">Detail</th>
            <th class="px-4 py-3 font-medium text-neutral-400">IP</th>
            <th class="px-4 py-3 font-medium text-neutral-400">Waktu</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-100">
          {#each data.items as log}
            <tr class="hover:bg-neutral-50">
              <td class="px-4 py-3 font-medium text-neutral-900">{log.action}</td>
              <td class="px-4 py-3 text-neutral-600">
                <span class="font-mono text-xs">{log.entity_type}</span>
                {#if log.entity_id}
                  <span class="ml-1 text-xs text-neutral-400">#{log.entity_id.slice(0, 8)}</span>
                {/if}
              </td>
              <td class="px-4 py-3 max-w-xs truncate text-neutral-600">{log.detail || '-'}</td>
              <td class="px-4 py-3 font-mono text-xs text-neutral-400">{log.ip_address || '-'}</td>
              <td class="px-4 py-3 text-neutral-400">{new Date(log.created_at).toLocaleString('id-ID')}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <Pagination page={data.page} perPage={data.per_page} total={data.total} onPageChange={(p) => load(p)} />
  </Card>
{/if}