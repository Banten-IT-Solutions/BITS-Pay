<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { auth } from '../../stores/auth';
  import { api } from '../../lib/api';
  import { showToast } from '../../lib/toast';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    message?: string;
    error?: string;
    onRetry?: () => void;
    retry?: () => void;
  }

  let { message, error, onRetry, retry }: Props = $props();
  const handleRetry = $derived(onRetry || retry);
  const rawMessage = $derived(error || message || 'Terjadi gangguan sistem.');

  const isEmailVerification = $derived(
    /verifikasi email/i.test(rawMessage) ||
    /email_not_verified/i.test(rawMessage)
  );

  let resending = $state(false);
  let resendCooldown = $state(0);
  let cooldownTimer: ReturnType<typeof setInterval> | null = null;

  async function handleResend() {
    if (resending || resendCooldown > 0) return;
    resending = true;
    try {
      await api.post('/auth/resend-verification');
      showToast('Tautan verifikasi baru berhasil dikirim ke email Anda!', 'success');
      resendCooldown = 60;
      if (cooldownTimer) clearInterval(cooldownTimer);
      cooldownTimer = setInterval(() => {
        resendCooldown -= 1;
        if (resendCooldown <= 0 && cooldownTimer) {
          clearInterval(cooldownTimer);
          cooldownTimer = null;
        }
      }, 1000);
    } catch (e) {
      showToast((e as Error).message || 'Gagal mengirim ulang email verifikasi', 'error');
    } finally {
      resending = false;
    }
  }

  function handleLogout() {
    auth.logout();
    push('/login');
  }

  const isDev = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.')
  );
</script>

{#if isEmailVerification}
  <div class="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-12 text-center" role="alert">
    <!-- Icon & Badge -->
    <div
      class="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent shadow-sm ring-8 ring-accent/5"
    >
      <Icon name="mail" size={28} />
      <span class="absolute -top-1 -right-1 flex h-3.5 w-3.5">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75"></span>
        <span class="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-surface bg-accent"></span>
      </span>
    </div>

    <!-- Title & Subtitle -->
    <h3 class="text-xl font-bold tracking-tight text-text sm:text-2xl">Verifikasi Email Anda</h3>
    <p class="mt-2 max-w-md text-sm leading-relaxed text-muted">
      Akun Anda sudah terdaftar. Silakan lakukan verifikasi email terlebih dahulu untuk mengaktifkan akses dashboard dan layanan pembayaran QRIS.
    </p>

    <!-- Checklist / Guide Box -->
    <div class="mt-6 w-full rounded-xl border border-border bg-surface-2/60 p-4 text-left shadow-xs">
      <p class="text-[11px] font-semibold uppercase tracking-wider text-muted">Panduan Cepat:</p>
      <ul class="mt-2.5 space-y-2.5 text-xs text-text">
        <li class="flex items-start gap-2.5">
          <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">1</span>
          <span>Buka kotak masuk email Anda (periksa juga folder <strong>Spam</strong> atau <strong>Promosi</strong>).</span>
        </li>
        <li class="flex items-start gap-2.5">
          <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">2</span>
          <span>Klik tombol atau tautan verifikasi yang dikirimkan oleh <strong>BITS Pay</strong>.</span>
        </li>
        <li class="flex items-start gap-2.5">
          <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">3</span>
          <span>Setelah itu, klik tombol <strong>Saya Sudah Verifikasi</strong> di bawah ini.</span>
        </li>
      </ul>
    </div>

    <!-- Action Buttons -->
    <div class="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
      {#if handleRetry}
        <Button variant="primary" onclick={handleRetry}>
          <Icon name="check" size={16} />
          Saya Sudah Verifikasi
        </Button>
      {/if}

      <Button
        variant="secondary"
        onclick={handleResend}
        disabled={resending || resendCooldown > 0}
      >
        <Icon name="refresh" size={15} />
        {#if resending}
          Mengirim...
        {:else if resendCooldown > 0}
          Kirim Ulang ({resendCooldown}s)
        {:else}
          Kirim Ulang Email Verifikasi
        {/if}
      </Button>
    </div>

    <div class="mt-4">
      <button
        type="button"
        class="text-xs text-muted hover:text-text cursor-pointer underline transition-colors"
        onclick={handleLogout}
      >
        Keluar atau Gunakan Akun Lain
      </button>
    </div>

    <!-- Developer Helper Note -->
    {#if isDev}
      <div class="mt-6 w-full rounded-lg border border-border/70 bg-surface-2 p-3 text-left text-[11px] text-muted">
        <div class="flex items-center gap-1.5 font-medium text-text">
          <Icon name="lock" size={12} />
          <span>Catatan Mode Pengembang (Dev):</span>
        </div>
        <p class="mt-1 leading-normal">
          Tautan verifikasi otomatis dicetak di <strong>terminal API</strong>. Anda juga dapat langsung mengaktifkan akun di D1 SQLite lokal:
        </p>
        <code class="mt-1.5 block overflow-x-auto rounded border border-border bg-surface px-2 py-1 font-mono text-[10px] text-text">
          UPDATE users SET email_verified = 1;
        </code>
      </div>
    {/if}
  </div>
{:else}
  <!-- Regular Error State -->
  <div class="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center" role="alert">
    <div
      class="mb-1 flex h-12 w-12 items-center justify-center rounded-[10px] border border-error/30 bg-error/10 text-error"
    >
      <Icon name="alert" size={22} />
    </div>
    <h3 class="text-[15px] font-semibold text-text">Gagal Memuat Data</h3>
    <p class="max-w-sm text-sm text-muted">{rawMessage}</p>
    {#if handleRetry}
      <div class="mt-3">
        <Button variant="secondary" onclick={handleRetry}>
          <Icon name="refresh" size={15} />
          Coba Lagi
        </Button>
      </div>
    {/if}
  </div>
{/if}
