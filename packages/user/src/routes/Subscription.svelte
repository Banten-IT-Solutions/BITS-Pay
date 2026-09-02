<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { workspaces } from '../stores/workspace';
  import Card from '../components/ui/Card.svelte';
  import Button from '../components/ui/Button.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Modal from '../components/ui/Modal.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import { showToast } from '../lib/toast';
  import type { Subscription, SubscriptionTier } from '@bits-pay/shared';

  interface UpgradeResponse {
    qr: {
      qris_dynamic: string;
      qr_image: string;
      amount_due: number;
    };
  }

  let sub = $state<Subscription | null>(null);
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
      sub = await api.get<Subscription | null>('/billing/subscriptions/current');
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
    '100 Transaksi per bulan',
    '10 req/s rate limit',
    'Callback URL tidak tersedia',
  ];
  const premiumFeatures = [
    '3 Workspace',
    '5 Aplikasi per workspace',
    '10.000 Transaksi per bulan',
    '100 req/s rate limit',
    'Callback URL + retry 3x',
    'Export laporan CSV',
    'Prioritas review manual',
    '5 Anggota tim',
  ];
</script>

<div class="mb-4">
  <h2 class="text-xl font-semibold">Langganan</h2>
</div>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else if sub}
  <Card title="Langganan Aktif">
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-neutral-400">Tier</p>
          <p class="text-lg font-semibold capitalize">
            {sub.tier === 'premium_monthly' ? 'Premium Bulanan' : 'Premium Tahunan'}
          </p>
        </div>
        <Badge status={sub.status} />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <p class="text-sm text-neutral-400">Mulai</p>
          <p class="font-medium">{new Date(sub.current_period_start).toLocaleDateString('id-ID')}</p>
        </div>
        <div>
          <p class="text-sm text-neutral-400">Berakhir</p>
          <p class="font-medium">{new Date(sub.current_period_end).toLocaleDateString('id-ID')}</p>
        </div>
      </div>
      <div>
        <p class="text-sm text-neutral-400">Biaya</p>
        <p class="text-lg font-bold text-primary-500">Rp {sub.amount.toLocaleString('id-ID')}</p>
      </div>
      {#if sub.status === 'active'}
        <div class="pt-2">
          <Button variant="danger" loading={cancelLoading} onclick={handleCancel}>
            Batalkan Langganan
          </Button>
        </div>
      {/if}
    </div>
  </Card>
{:else}
  <div class="grid gap-6 lg:grid-cols-2">
    <Card title="Free" subtitle="Cocok untuk mencoba">
      <div class="space-y-4">
        <p class="text-3xl font-bold text-neutral-900">Gratis</p>
        <ul class="space-y-2">
          {#each freeFeatures as f}
            <li class="flex items-center gap-2 text-sm text-neutral-600">
              <span class="text-success">&#10003;</span> {f}
            </li>
          {/each}
        </ul>
        <p class="text-xs text-neutral-400">Sedang dipakai</p>
      </div>
    </Card>
    <Card title="Premium" subtitle="Untuk bisnis serius">
      <div class="space-y-4">
        <p class="text-3xl font-bold text-primary-500">Rp 50.000<span class="text-base font-normal text-neutral-400">/bln</span></p>
        <ul class="space-y-2">
          {#each premiumFeatures as f}
            <li class="flex items-center gap-2 text-sm text-neutral-600">
              <span class="text-success">&#10003;</span> {f}
            </li>
          {/each}
        </ul>
        <div class="space-y-2">
          <Button block loading={upgrading} onclick={() => handleUpgrade('premium_monthly')}>
            Premium Bulanan Rp 50.000
          </Button>
          <Button variant="secondary" block loading={upgrading} onclick={() => handleUpgrade('premium_yearly')}>
            Premium Tahunan Rp 500.000
          </Button>
        </div>
      </div>
    </Card>
  </div>
{/if}

<Modal open={showQr} title="Bayar Langganan" onClose={() => showQr = false}>
  {#if qrData}
    <div class="flex flex-col items-center gap-4">
      <img src={qrData.qr.qr_image} alt="QRIS" class="w-64 rounded-lg border" />
      <div class="text-center">
        <p class="text-sm text-neutral-400">Total Pembayaran</p>
        <p class="text-2xl font-bold text-neutral-900">Rp {qrData.qr.amount_due.toLocaleString('id-ID')}</p>
        <p class="text-xs text-neutral-400">(termasuk kode unik)</p>
      </div>
      <p class="text-center text-sm text-neutral-400">Scan QRIS di atas menggunakan aplikasi pembayaran untuk menyelesaikan pembayaran.</p>
    </div>
  {/if}
</Modal>