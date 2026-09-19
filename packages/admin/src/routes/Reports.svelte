<script lang="ts">
  import { onMount } from 'svelte';
  import { api, BASE_URL } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Button from '../components/ui/Button.svelte';
  import Icon from '../components/ui/Icon.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import DataTable, { bodyCell, type TableHeader } from '../components/ui/DataTable.svelte';
  import { formatAmount } from '@bits-pay/shared';

  interface DailyReport {
    day: string;
    count: number;
    revenue: number;
  }

  let report = $state<DailyReport[]>([]);
  let loading = $state(true);
  let error = $state('');
  let days = $state('30');
  let exporting = $state(false);

  const totalRevenue = $derived(report.reduce((s, r) => s + r.revenue, 0));
  const totalCount = $derived(report.reduce((s, r) => s + r.count, 0));
  const maxRevenue = $derived(Math.max(1, ...report.map((r) => r.revenue)));
  const bestDay = $derived(report.reduce<DailyReport | null>((best, r) => (r.revenue > (best?.revenue ?? -1) ? r : best), null));

  const headers: TableHeader[] = [
    { label: 'Tanggal' },
    { label: 'Transaksi', align: 'right' },
    { label: 'Revenue', align: 'right' },
  ];

  function errMsg(e: unknown): string {
    return e instanceof Error ? e.message : 'Terjadi kesalahan';
  }

  async function load() {
    loading = true;
    error = '';
    try {
      report = await api.get<DailyReport[]>(`/admin/reports/transactions?days=${days}`);
    } catch (e) {
      error = errMsg(e);
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function exportCsv() {
    exporting = true;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/admin/reports/export?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export gagal');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transactions.csv';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Export dimulai', 'success');
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      exporting = false;
    }
  }
</script>

<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
  <p class="text-[13px] text-neutral-600">Ringkasan {days} hari terakhir</p>
  <div class="flex items-center gap-2">
    <select class="input w-auto flex-none" aria-label="Rentang waktu" bind:value={days} onchange={load}>
      <option value="7">7 hari</option>
      <option value="30">30 hari</option>
      <option value="90">90 hari</option>
    </select>
    <Button variant="secondary" loading={exporting} onclick={exportCsv}>
      <Icon name="download" size={15} />
      Export CSV
    </Button>
  </div>
</div>

{#if error && report.length === 0}
  <ErrorState {error} onRetry={load} />
{:else if report.length === 0 && !loading}
  <EmptyState message="Tidak ada data transaksi pada rentang ini." icon="reports" />
{:else}
  <!-- Ringkasan periode -->
  <div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
    <Card>
      <p class="font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">Total Revenue</p>
      <p class="num mt-2 truncate text-2xl font-semibold text-neutral-900">
        {#if loading}<span class="skeleton inline-block h-7 w-32"></span>{:else}{formatAmount(totalRevenue)}{/if}
      </p>
    </Card>
    <Card>
      <p class="font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">Total Transaksi</p>
      <p class="num mt-2 text-2xl font-semibold text-neutral-900">
        {#if loading}<span class="skeleton inline-block h-7 w-20"></span>{:else}{totalCount.toLocaleString('id-ID')}{/if}
      </p>
    </Card>
    <Card>
      <p class="font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">Hari Terbaik</p>
      <p class="num mt-2 truncate text-2xl font-semibold text-accent-600">
        {#if loading}<span class="skeleton inline-block h-7 w-32"></span>{:else}{bestDay ? formatAmount(bestDay.revenue) : '-'}{/if}
      </p>
      {#if bestDay && !loading}
        <p class="num mt-1 text-xs text-neutral-600">{bestDay.day}</p>
      {/if}
    </Card>
  </div>

  <Card title="Revenue per Hari" subtitle="Arahkan kursor atau sentuh batang untuk detail">
    {#if loading}
      <div class="flex h-48 items-end gap-1">
        {#each Array.from({ length: 20 }) as _, i (i)}
          <div class="skeleton w-full" style:height="{20 + ((i * 37) % 130)}px"></div>
        {/each}
      </div>
    {:else}
      <div class="flex h-48 items-end gap-1" role="img" aria-label="Grafik batang revenue per hari">
        {#each report as r (r.day)}
          <div
            class="group relative flex-1 rounded-t-sm bg-primary-200 transition-colors hover:bg-primary-500"
            style:height="{Math.max(2, (r.revenue / maxRevenue) * 100)}%"
            title="{r.day}: {formatAmount(r.revenue)} ({r.count} transaksi)"
          ></div>
        {/each}
      </div>
      <div class="mt-2 flex justify-between font-mono text-[10px] text-neutral-400">
        <span>{report[0]?.day}</span>
        <span>{report[report.length - 1]?.day}</span>
      </div>
    {/if}
  </Card>

  <div class="mt-4">
    <Card padding={false} title="Data Harian">
      <DataTable {headers} loading={loading && report.length === 0} loadingRows={7}>
        {#each report as r (r.day)}
          <tr class="transition-colors hover:bg-primary-50/50">
            <td class="{bodyCell(headers[0], 0, false)} num text-neutral-900">{r.day}</td>
            <td class="{bodyCell(headers[1], 1, false)} num text-neutral-600">{r.count.toLocaleString('id-ID')}</td>
            <td class="{bodyCell(headers[2], 2, false)} num font-medium text-neutral-900">{formatAmount(r.revenue)}</td>
          </tr>
        {/each}
      </DataTable>
    </Card>
  </div>
{/if}
