<script lang="ts">
  import { onMount } from 'svelte';
  import { api, BASE_URL } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Button from '../components/ui/Button.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';

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

<div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h2 class="text-xl font-semibold">Laporan Transaksi</h2>
    <p class="text-sm text-neutral-400">Ringkasan transaksi {days} hari terakhir</p>
  </div>
  <div class="flex items-center gap-2">
    <select class="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" bind:value={days} onchange={load}>
      <option value="7">7 hari</option>
      <option value="30">30 hari</option>
      <option value="90">90 hari</option>
    </select>
    <Button variant="secondary" loading={exporting} onclick={exportCsv}>Export CSV</Button>
  </div>
</div>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else if report.length === 0}
  <EmptyState message="Tidak ada data transaksi." />
{:else}
  <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
    <Card>
      <div class="text-center">
        <p class="text-sm text-neutral-400">Total Transaksi</p>
        <p class="text-3xl font-bold text-neutral-900">{totalCount.toLocaleString('id-ID')}</p>
      </div>
    </Card>
    <Card>
      <div class="text-center">
        <p class="text-sm text-neutral-400">Total Revenue</p>
        <p class="text-3xl font-bold text-success">Rp {totalRevenue.toLocaleString('id-ID')}</p>
      </div>
    </Card>
  </div>

  <Card title="Grafik Revenue per Hari">
    <div class="flex h-48 items-end gap-1">
      {#each report as r}
        <div class="flex flex-1 flex-col items-center justify-end gap-1" title="{r.day}: Rp {r.revenue.toLocaleString('id-ID')}">
          <div class="w-full max-w-10 rounded-t bg-primary-500" style:height="{Math.max(2, (r.revenue / maxRevenue) * 160)}px"></div>
        </div>
      {/each}
    </div>
  </Card>

  <div class="mt-4">
    <Card>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-neutral-100">
            <tr>
              <th class="px-4 py-3 font-medium text-neutral-400">Tanggal</th>
              <th class="px-4 py-3 font-medium text-neutral-400">Transaksi</th>
              <th class="px-4 py-3 font-medium text-neutral-400">Revenue</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100">
            {#each report as r}
              <tr class="hover:bg-neutral-50">
                <td class="px-4 py-3">{r.day}</td>
                <td class="px-4 py-3">{r.count}</td>
                <td class="px-4 py-3">Rp {r.revenue.toLocaleString('id-ID')}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Card>
  </div>
{/if}