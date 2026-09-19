<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { workspaces } from '../stores/workspace';
  import Card from '../components/ui/Card.svelte';
  import Button from '../components/ui/Button.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Modal from '../components/ui/Modal.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import Icon from '../components/ui/Icon.svelte';
  import { showToast } from '../lib/toast';
  import { formatDate } from '../lib/format';
  import {
    formatAmount,
    type Subscription,
    type SubscriptionTier,
    type UserMe,
  } from '@bits-pay/shared';

  interface UpgradeResponse {
    qr: {
      qris_dynamic: string;
      qr_image: string;
      amount_due: number;
    };
  }

  let sub = $state<Subscription | null>(null);
  let me = $state<UserMe | null>(null);
  let loading = $state(true);
  let error = $state('');
  let upgrading = $state(false);
  let cancelLoading = $state(false);
  let showQr = $state(false);
  let qrData = $state<UpgradeResponse | null>(null);

  async function load() {
    loading = true;
    error = '';
    try {
      const [current, profile] = await Promise.all([
        api.get<Subscription | null>('/billing/subscriptions/current'),
        api.get<UserMe>('/auth/me'),
      ]);
      sub = current;
      me = profile;
    } catch (e) {
      error = (e as Error).message || 'Gagal memuat data langganan';
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function handleUpgrade(tier: SubscriptionTier) {
    const wsList = $workspaces;
    if (wsList.length === 0) {
      showToast('Buat workspace terlebih dahulu', 'warning');
      return;
    }
    upgrading = true;
    try {
      const res = await api.post<UpgradeResponse>('/billing/subscriptions/upgrade', {
        tier,
        workspace_id: wsList[0].id,
      });
      qrData = res;
      showQr = true;
    } catch (e) {
      showToast((e as Error).message || 'Gagal upgrade', 'error');
    } finally {
      upgrading = false;
    }
  }

  async function handleCancel() {
    cancelLoading = true;
    try {
      await api.post('/billing/subscriptions/cancel');
      showToast('Langganan dibatalkan', 'success');
      await load();
    } catch (e) {
      showToast((e as Error).message || 'Gagal membatalkan', 'error');
    } finally {
      cancelLoading = false;
    }
  }

  const freeFeatures = [
    '1 Workspace',
    '1 Aplikasi per workspace',
    '300 Transaksi per bulan',
    '10 req/s rate limit',
  ];
  const premiumFeatures = [
    '1 Workspace',
    '3 Aplikasi',
    '3.000 Transaksi per bulan',
    '100 req/s rate limit',
    'Callback URL + retry 3x',
    '5 Anggota tim',
  ];
</script>

{#if loading}
  <div class="space-y-4">
    <div class="skeleton h-8 w-56 rounded-lg"></div>
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="skeleton h-72 rounded-[10px]"></div>
      <div class="skeleton h-72 rounded-[10px]"></div>
    </div>
  </div>
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else if sub}
  <Card title="Langganan Aktif" class="max-w-xl">
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs font-medium text-faint">Tier</p>
          <p class="mt-0.5 font-display text-lg font-semibold text-text">
            {sub.tier === 'premium_monthly' ? 'Premium Bulanan' : 'Premium Tahunan'}
          </p>
        </div>
        <Badge status={sub.status} />
      </div>
      <div class="grid grid-cols-2 gap-4 border-t border-dashed border-border pt-4">
        <div>
          <p class="text-xs font-medium text-faint">Mulai</p>
          <p class="mt-0.5 text-sm font-medium text-text">{formatDate(sub.current_period_start)}</p>
        </div>
        <div>
          <p class="text-xs font-medium text-faint">Berakhir</p>
          <p class="mt-0.5 text-sm font-medium text-text">{formatDate(sub.current_period_end)}</p>
        </div>
      </div>
      <div class="border-t border-dashed border-border pt-4">
        <p class="text-xs font-medium text-faint">Biaya</p>
        <p class="num mt-0.5 text-xl font-semibold text-text">{formatAmount(sub.amount)}</p>
      </div>
      {#if sub.status === 'active'}
        <div class="border-t border-dashed border-border pt-4">
          <Button variant="danger" loading={cancelLoading} onclick={handleCancel}>
            Batalkan Langganan
          </Button>
        </div>
      {/if}
    </div>
  </Card>
{:else}
  {#if me?.is_trial && me.tier_expires_at}
    <div
      class="mb-5 flex items-start gap-2.5 rounded-[10px] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
      role="status"
    >
      <span class="mt-0.5 flex-none"><Icon name="clock" size={16} /></span>
      <p>
        Kamu dalam masa <strong>trial premium</strong> sampai
        <strong>{formatDate(me.tier_expires_at)}</strong>. Setelah itu akun turun ke Free dan
        resource berlebih dibekukan.
      </p>
    </div>
  {/if}
  <div class="grid items-start gap-4 lg:grid-cols-2">
    <Card title="Free" subtitle="Cocok untuk mencoba">
      <p class="num text-3xl font-semibold text-text">Gratis</p>
      <ul class="mt-5 space-y-2.5 border-t border-border pt-4">
        {#each freeFeatures as f (f)}
          <li class="flex items-center gap-2.5 text-sm text-muted">
            <span class="flex-none text-success"><Icon name="check" size={15} /></span>
            {f}
          </li>
        {/each}
        <li class="flex items-center gap-2.5 text-sm text-faint">
          <span class="flex-none"><Icon name="x" size={15} /></span>
          Callback URL tidak tersedia
        </li>
      </ul>
      <p class="mt-5 text-xs font-medium text-faint">Sedang dipakai</p>
    </Card>

    <Card
      title="Premium"
      subtitle="Untuk bisnis serius"
      class="relative border-accent shadow-[0_0_0_1px_var(--accent)]"
    >
      {#snippet actions()}
        <span
          class="rounded-md bg-accent px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] text-on-accent uppercase"
        >
          Rekomendasi
        </span>
      {/snippet}
      <p class="num text-3xl font-semibold text-text">
        50.000<span class="text-base font-normal text-faint">/bln</span>
      </p>
      <ul class="mt-5 space-y-2.5 border-t border-border pt-4">
        {#each premiumFeatures as f (f)}
          <li class="flex items-center gap-2.5 text-sm text-muted">
            <span class="flex-none text-success"><Icon name="check" size={15} /></span>
            {f}
          </li>
        {/each}
      </ul>
      <div class="mt-5 space-y-2">
        <Button block loading={upgrading} onclick={() => handleUpgrade('premium_monthly')}>
          Premium Bulanan — Rp50.000
        </Button>
        <Button
          variant="secondary"
          block
          loading={upgrading}
          onclick={() => handleUpgrade('premium_yearly')}
        >
          Premium Tahunan — Rp500.000
        </Button>
      </div>
    </Card>
  </div>
{/if}

<Modal open={showQr} title="Bayar Langganan" onClose={() => (showQr = false)}>
  {#if qrData}
    <div class="flex flex-col items-center gap-4">
      <div class="rounded-lg border border-border bg-white p-4">
        <img src={qrData.qr.qr_image} alt="Kode QRIS langganan premium" class="w-56 max-w-full" />
      </div>
      <div class="text-center">
        <p class="text-xs font-medium text-faint">Total Pembayaran</p>
        <p class="num mt-1 text-2xl font-semibold text-text">
          {formatAmount(qrData.qr.amount_due)}
        </p>
        <p class="mt-1 text-xs text-faint">(sudah termasuk kode unik)</p>
      </div>
      <p class="text-center text-sm text-muted">
        Scan QRIS di atas menggunakan aplikasi pembayaran untuk menyelesaikan pembayaran.
      </p>
    </div>
  {/if}
</Modal>
