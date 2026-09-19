<script lang="ts">
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast';
  import { workspaces } from '../stores/workspace';
  import Modal from './ui/Modal.svelte';
  import Button from './ui/Button.svelte';
  import Input from './ui/Input.svelte';
  import Icon from './ui/Icon.svelte';
  import Badge from './ui/Badge.svelte';
  import type { AppWithSecrets, ChargeCreateResponse } from '@bits-pay/shared';

  interface Props {
    open: boolean;
    onClose: () => void;
  }
  let { open, onClose }: Props = $props();

  const STEPS = ['Workspace', 'App & API Key', 'Test Charge'];
  // Test charge pakai API key app yang baru dibuat (public API /v1/charges
  // pakai Bearer sk_..., bukan JWT) — api client selalu kirim JWT, jadi fetch langsung.
  const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:7001`;

  let step = $state<1 | 2 | 3>(1);
  let submitting = $state(false);
  let root = $state<HTMLDivElement | null>(null);

  // Langkah 1
  let wsName = $state('');
  let wsSlug = $state('');
  let slugTouched = $state(false);
  let wid = $state('');

  // Langkah 2
  let appName = $state('');
  let callbackUrl = $state('');
  let apiKey = $state('');
  let callbackSecret = $state('');

  // Langkah 3
  let orderId = $state('');
  let amount = $state('');
  let charge = $state<ChargeCreateResponse | null>(null);

  function onWsNameInput(e: Event) {
    wsName = (e.target as HTMLInputElement).value;
    // Auto-slug sampai user edit slug manual.
    if (!slugTouched) {
      wsSlug = wsName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
  }

  // Fokus input pertama setiap ganti langkah.
  $effect(() => {
    if (open && root) {
      void step;
      requestAnimationFrame(() => root?.querySelector('input')?.focus());
    }
  });

  function selesai() {
    localStorage.setItem('onboarding-done', '1');
    onClose();
  }

  async function buatWorkspace() {
    if (!wsName || !wsSlug) return;
    submitting = true;
    try {
      const ws = await workspaces.create({ name: wsName, slug: wsSlug });
      wid = ws.id;
      step = 2;
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      submitting = false;
    }
  }

  async function buatApp() {
    if (!appName || !wid) return;
    submitting = true;
    try {
      const app = await api.post<AppWithSecrets>(`/app/workspaces/${wid}/apps`, {
        name: appName,
        callback_url: callbackUrl || undefined,
      });
      apiKey = app.api_key;
      callbackSecret = app.callback_secret;
      showToast('App berhasil dibuat', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      submitting = false;
    }
  }

  async function testCharge() {
    const amountNum = Number(amount);
    if (!orderId || !Number.isInteger(amountNum) || amountNum < 100) {
      showToast('Order ID wajib diisi dan amount minimal Rp100', 'error');
      return;
    }
    submitting = true;
    try {
      const res = await fetch(`${API_BASE}/v1/charges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          order_id: orderId,
          amount: amountNum,
          description: 'Test charge onboarding',
        }),
      });
      const json = (await res.json()) as
        | { success: true; data: ChargeCreateResponse }
        | { success: false; error: { message: string } };
      if (!res.ok || !json.success) {
        throw new Error(json.success ? 'Gagal membuat charge' : json.error.message);
      }
      charge = json.data;
      showToast('Test charge berhasil dibuat', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      submitting = false;
    }
  }

  async function salin(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} disalin`, 'success');
    } catch {
      showToast('Gagal menyalin — salin manual', 'error');
    }
  }

  function rupiah(n: number): string {
    return `Rp${n.toLocaleString('id-ID')}`;
  }
</script>

<Modal {open} title="Selamat Datang di BITS Pay" onClose={selesai}>
  <div bind:this={root}>
    <ol class="mb-6 flex items-center gap-2" aria-label="Progres onboarding">
      {#each STEPS as label, i (i)}
        {@const n = i + 1}
        {#if i > 0}
          <li class="h-px flex-1 {step >= n ? 'bg-accent' : 'bg-border'}" aria-hidden="true"></li>
        {/if}
        <li
          class="flex items-center gap-2"
          aria-current={step === n ? 'step' : undefined}
        >
          <span
            class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold {step >=
            n
              ? 'bg-accent text-on-accent'
              : 'bg-surface-2 text-faint'}"
          >
            {#if step > n}
              <Icon name="check" size={14} />
            {:else}
              {n}
            {/if}
          </span>
          <span class="text-xs {step === n ? 'font-medium text-text' : 'text-faint'}">
            {label}
          </span>
        </li>
      {/each}
    </ol>

    {#if step === 1}
      <p class="mb-4 text-sm text-muted">
        Mulai dengan membuat workspace — wadah untuk app dan transaksi bisnismu.
      </p>
      <form
        onsubmit={(e) => {
          e.preventDefault();
          buatWorkspace();
        }}
        class="space-y-4"
      >
        <Input
          label="Nama Workspace"
          value={wsName}
          oninput={onWsNameInput}
          placeholder="Toko Saya"
          required
        />
        <Input
          label="Slug"
          value={wsSlug}
          oninput={(e) => {
            slugTouched = true;
            wsSlug = (e.target as HTMLInputElement).value;
          }}
          placeholder="toko-saya"
          required
        />
        <p class="text-xs text-faint">Slug hanya boleh huruf kecil, angka, dan strip.</p>
        <div class="flex items-center justify-between pt-1">
          <Button variant="ghost" onclick={selesai}>Lewati</Button>
          <Button type="submit" loading={submitting} disabled={!wsName || !wsSlug}>Lanjut</Button>
        </div>
      </form>
    {:else if step === 2}
      {#if !apiKey}
        <p class="mb-4 text-sm text-muted">
          Buat app pertama untuk mendapatkan API key integrasi.
        </p>
        <form
          onsubmit={(e) => {
            e.preventDefault();
            buatApp();
          }}
          class="space-y-4"
        >
          <Input
            label="Nama App"
            value={appName}
            oninput={(e) => (appName = (e.target as HTMLInputElement).value)}
            placeholder="Website Toko Saya"
            required
          />
          <Input
            label="Callback URL (opsional)"
            type="url"
            value={callbackUrl}
            oninput={(e) => (callbackUrl = (e.target as HTMLInputElement).value)}
            placeholder="https://example.com/callback"
          />
          <div class="flex items-center justify-between pt-1">
            <Button variant="ghost" onclick={() => (step = 1)}>Kembali</Button>
            <div class="flex gap-2">
              <Button variant="ghost" onclick={() => (step = 3)}>Lewati</Button>
              <Button type="submit" loading={submitting} disabled={!appName}>Buat App</Button>
            </div>
          </div>
        </form>
      {:else}
        <div
          class="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
          role="alert"
        >
          API key dan callback secret hanya ditampilkan sekali — simpan sekarang di tempat aman.
        </div>
        <div class="space-y-3">
          <div>
            <span class="mb-1.5 block text-[13px] font-medium text-muted">API Key</span>
            <div class="flex items-center gap-2">
              <code
                class="num min-w-0 flex-1 truncate rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs text-text"
              >
                {apiKey}
              </code>
              <Button variant="secondary" size="sm" onclick={() => salin(apiKey, 'API Key')}>
                <Icon name="copy" size={14} />
                Salin
              </Button>
            </div>
          </div>
          <div>
            <span class="mb-1.5 block text-[13px] font-medium text-muted">Callback Secret</span>
            <div class="flex items-center gap-2">
              <code
                class="num min-w-0 flex-1 truncate rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs text-text"
              >
                {callbackSecret}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onclick={() => salin(callbackSecret, 'Callback Secret')}
              >
                <Icon name="copy" size={14} />
                Salin
              </Button>
            </div>
          </div>
        </div>
        <div class="flex items-center justify-between pt-4">
          <Button variant="ghost" onclick={() => (step = 1)}>Kembali</Button>
          <Button onclick={() => (step = 3)}>Lanjut</Button>
        </div>
      {/if}
    {:else}
      {#if !charge}
        <p class="mb-4 text-sm text-muted">
          Coba buat test charge pertama memakai API key app barumu.
        </p>
        {#if !apiKey}
          <p class="mb-4 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
            Kamu melewati pembuatan app, jadi test charge dilewati. Buat app dulu dari menu Apps
            untuk mencoba.
          </p>
        {/if}
        <form
          onsubmit={(e) => {
            e.preventDefault();
            testCharge();
          }}
          class="space-y-4"
        >
          <Input
            label="Order ID"
            value={orderId}
            oninput={(e) => (orderId = (e.target as HTMLInputElement).value)}
            placeholder="ORD-TEST-001"
            required
            disabled={!apiKey}
          />
          <Input
            label="Amount (Rp)"
            type="number"
            step="1"
            value={amount}
            oninput={(e) => (amount = (e.target as HTMLInputElement).value)}
            placeholder="150000"
            required
            disabled={!apiKey}
          />
          <div class="flex items-center justify-between pt-1">
            <Button variant="ghost" onclick={() => (step = 2)}>Kembali</Button>
            <div class="flex gap-2">
              <Button variant="ghost" onclick={selesai}>Lewati</Button>
              <Button type="submit" loading={submitting} disabled={!apiKey || !orderId || !amount}>
                Buat Charge
              </Button>
            </div>
          </div>
        </form>
      {:else}
        <div class="mb-4 flex items-center gap-2">
          <h4 class="text-sm font-semibold text-text">Charge berhasil dibuat</h4>
          <Badge status={charge.status} />
        </div>
        <div class="mb-4 rounded-lg border border-border bg-surface-2 p-3">
          <dl class="space-y-1.5 text-xs">
            <div class="flex justify-between gap-3">
              <dt class="text-faint">Order ID</dt>
              <dd class="num text-text">{orderId}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-faint">Amount</dt>
              <dd class="num text-text">{rupiah(charge.amount)}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-faint">Kode Unik</dt>
              <dd class="num text-text">+{charge.unique_code}</dd>
            </div>
            <div class="flex justify-between gap-3 font-semibold">
              <dt class="text-muted">Total Bayar</dt>
              <dd class="num text-accent">{rupiah(charge.amount_due)}</dd>
            </div>
          </dl>
        </div>
        {#if charge.qr_image}
          <img
            src={charge.qr_image}
            alt="QRIS test charge"
            class="mx-auto mb-4 h-44 w-44 rounded-lg border border-border bg-white p-2"
          />
        {/if}
        <div class="flex items-center justify-between">
          <Button variant="ghost" onclick={() => (charge = null)}>Buat Lagi</Button>
          <Button onclick={selesai}>Selesai</Button>
        </div>
      {/if}
    {/if}
  </div>
</Modal>
