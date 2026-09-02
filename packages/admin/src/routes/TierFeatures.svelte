<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Button from '../components/ui/Button.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import type { TierFeatures as TierFeaturesType } from '@bits-pay/shared';

  type Editable = Omit<TierFeaturesType, 'tier'>;
  type FieldKey = keyof Editable;

  const fieldKeys: FieldKey[] = [
    'max_workspaces',
    'max_apps',
    'max_transactions_month',
    'max_transactions_per_day',
    'api_rate_limit',
    'callback_allowed',
    'callback_retry_count',
    'report_export',
    'priority_review',
    'max_team_members',
  ];

  const labels: Record<FieldKey, string> = {
    max_workspaces: 'Max Workspace',
    max_apps: 'Max Aplikasi',
    max_transactions_month: 'Max Transaksi / Bulan',
    max_transactions_per_day: 'Max Transaksi / Hari',
    api_rate_limit: 'Rate Limit API (req/s)',
    callback_allowed: 'Callback Diizinkan (0/1)',
    callback_retry_count: 'Maks Retry Callback',
    report_export: 'Export Laporan (0/1)',
    priority_review: 'Review Prioritas (0/1)',
    max_team_members: 'Max Anggota Tim',
  };

  const empty: Record<FieldKey, string> = {
    max_workspaces: '',
    max_apps: '',
    max_transactions_month: '',
    max_transactions_per_day: '',
    api_rate_limit: '',
    callback_allowed: '',
    callback_retry_count: '',
    report_export: '',
    priority_review: '',
    max_team_members: '',
  };

  let loading = $state(true);
  let error = $state('');
  let saving = $state(false);
  let free = $state<Record<FieldKey, string>>({ ...empty });
  let premium = $state<Record<FieldKey, string>>({ ...empty });

  function errMsg(e: unknown): string {
    return e instanceof Error ? e.message : 'Terjadi kesalahan';
  }

  function fill(f: TierFeaturesType): Record<FieldKey, string> {
    const out: Record<FieldKey, string> = { ...empty };
    for (const k of fieldKeys) out[k] = String(f[k]);
    return out;
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const data = await api.get<{ free: TierFeaturesType; premium: TierFeaturesType }>('/admin/tier-features');
      free = fill(data.free);
      premium = fill(data.premium);
    } catch (e) {
      error = errMsg(e);
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function toNumbers(v: Record<FieldKey, string>): Editable {
    const out = {} as Editable;
    for (const k of fieldKeys) out[k] = Number(v[k]) || 0;
    return out;
  }

  async function save() {
    saving = true;
    try {
      await api.put('/admin/tier-features', {
        free: toNumbers(free),
        premium: toNumbers(premium),
      });
      showToast('Fitur tier disimpan', 'success');
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      saving = false;
    }
  }
</script>

<div class="mb-4 flex items-center justify-between">
  <h2 class="text-xl font-semibold">Fitur Tier</h2>
  <Button loading={saving} onclick={save}>Simpan</Button>
</div>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else}
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <Card title="Free" subtitle="Limit untuk pengguna gratis">
      <div class="space-y-4">
        {#each fieldKeys as k}
          <div>
            <label class="mb-1 block text-sm font-medium text-neutral-600">{labels[k]}</label>
            <input type="number" class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" bind:value={free[k]} />
          </div>
        {/each}
      </div>
    </Card>
    <Card title="Premium" subtitle="Limit untuk pengguna premium">
      <div class="space-y-4">
        {#each fieldKeys as k}
          <div>
            <label class="mb-1 block text-sm font-medium text-neutral-600">{labels[k]}</label>
            <input type="number" class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" bind:value={premium[k]} />
          </div>
        {/each}
      </div>
    </Card>
  </div>
{/if}