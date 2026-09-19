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

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else}
  <div class="max-w-4xl">
    <Card padding={false}>
      <!-- Header kolom tier -->
      <div class="grid grid-cols-[1fr_96px_96px] items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-5 py-2.5 sm:grid-cols-[1fr_160px_160px]">
        <span class="font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">Limit</span>
        <span class="text-center font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">Free</span>
        <span class="text-center font-mono text-[10.5px] font-medium tracking-[0.1em] text-primary-600 uppercase">Premium</span>
      </div>
      <div class="divide-y divide-neutral-100">
        {#each fieldKeys as k (k)}
          <div class="grid grid-cols-[1fr_96px_96px] items-center gap-2 px-5 py-2.5 sm:grid-cols-[1fr_160px_160px]">
            <label for="free-{k}" class="text-[13px] text-neutral-900">{labels[k]}</label>
            <input id="free-{k}" type="number" inputmode="numeric" class="input num h-9 px-2 text-center" aria-label="{labels[k]} — Free" bind:value={free[k]} />
            <input type="number" inputmode="numeric" class="input num h-9 px-2 text-center" aria-label="{labels[k]} — Premium" bind:value={premium[k]} />
          </div>
        {/each}
      </div>
      <div class="flex justify-end border-t border-neutral-100 px-5 py-3">
        <Button loading={saving} onclick={save}>Simpan</Button>
      </div>
    </Card>
  </div>
{/if}
