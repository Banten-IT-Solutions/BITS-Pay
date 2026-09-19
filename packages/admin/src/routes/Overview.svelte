<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import Card from '../components/ui/Card.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import Icon from '../components/ui/Icon.svelte';
  import { formatAmount, type AdminOverview } from '@bits-pay/shared';

  let data = $state<AdminOverview | null>(null);
  let loading = $state(true);
  let error = $state('');

  async function load() {
    loading = true;
    error = '';
    try {
      data = await api.get<AdminOverview>('/admin/overview');
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(load);
</script>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else if data}
  <!-- Antrean kerja paling penting diangkat paling atas -->
  {#if data.pending_review_count > 0}
    <button
      type="button"
      class="mb-5 flex w-full items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-left transition-colors hover:bg-warning/15"
      onclick={() => push('/review')}
    >
      <span class="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-warning/20 text-neutral-900">
        <Icon name="review" size={18} />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-semibold text-neutral-900">
          {data.pending_review_count} transaksi menunggu review
        </span>
        <span class="block text-[13px] text-neutral-600">Bukti bayar perlu dicek manual sebelum dana diteruskan.</span>
      </span>
      <span class="flex flex-none items-center gap-1 text-sm font-semibold text-neutral-900">
        Buka antrean
        <Icon name="chevron-right" size={16} />
      </span>
    </button>
  {/if}

  <!-- Metrik utama: uang & kerja hari ini -->
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <Card>
      <p class="font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">Total Revenue</p>
      <p class="num mt-2 truncate text-2xl font-semibold text-neutral-900">{formatAmount(data.total_revenue)}</p>
      <p class="mt-1 text-xs text-neutral-600">dari {data.total_payments.toLocaleString('id-ID')} transaksi</p>
    </Card>
    <Card>
      <p class="font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">Revenue Hari Ini</p>
      <p class="num mt-2 truncate text-2xl font-semibold text-accent-600">{formatAmount(data.today_revenue)}</p>
      <p class="mt-1 text-xs text-neutral-600">{data.today_payments.toLocaleString('id-ID')} transaksi hari ini</p>
    </Card>
    <Card class={data.pending_review_count > 0 ? 'border-warning/50' : ''}>
      <p class="font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">Pending Review</p>
      <p class="num mt-2 text-2xl font-semibold {data.pending_review_count > 0 ? 'text-error' : 'text-neutral-900'}">
        {data.pending_review_count.toLocaleString('id-ID')}
      </p>
      <p class="mt-1 text-xs text-neutral-600">
        {#if data.pending_review_count > 0}
          <button type="button" class="font-medium text-primary-600 hover:underline" onclick={() => push('/review')}>
            Proses sekarang
          </button>
        {:else}
          Antrean bersih
        {/if}
      </p>
    </Card>
    <Card>
      <p class="font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">Pertumbuhan User</p>
      <p class="num mt-2 text-2xl font-semibold text-neutral-900">{data.user_growth}%</p>
      <p class="mt-1 text-xs text-neutral-600">{data.active_subscriptions.toLocaleString('id-ID')} langganan aktif</p>
    </Card>
  </div>

  <!-- Metrik sekunder: satu strip terbagi, bukan kartu generik -->
  <div class="mt-3 grid grid-cols-2 divide-neutral-200 rounded-xl border border-neutral-200 bg-white max-lg:gap-px max-lg:bg-neutral-200 lg:grid-cols-4 lg:divide-x">
    <div class="p-4 max-lg:rounded-xl max-lg:bg-white">
      <p class="font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">Total User</p>
      <p class="num mt-1.5 text-lg font-semibold text-neutral-900">{data.total_users.toLocaleString('id-ID')}</p>
    </div>
    <div class="p-4 max-lg:rounded-xl max-lg:bg-white">
      <p class="font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">Total Transaksi</p>
      <p class="num mt-1.5 text-lg font-semibold text-neutral-900">{data.total_payments.toLocaleString('id-ID')}</p>
    </div>
    <div class="p-4 max-lg:rounded-xl max-lg:bg-white">
      <p class="font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">Langganan Aktif</p>
      <p class="num mt-1.5 text-lg font-semibold text-neutral-900">{data.active_subscriptions.toLocaleString('id-ID')}</p>
    </div>
    <div class="p-4 max-lg:rounded-xl max-lg:bg-white">
      <p class="font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase">Transaksi Hari Ini</p>
      <p class="num mt-1.5 text-lg font-semibold text-neutral-900">{data.today_payments.toLocaleString('id-ID')}</p>
    </div>
  </div>
{/if}
