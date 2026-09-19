<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import { getQueryParam } from '../lib/query';
  import { showToast } from '../lib/toast';
  import AuthLayout from '../components/layout/AuthLayout.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';
  import Icon from '../components/ui/Icon.svelte';

  let status = $state<'loading' | 'success' | 'error'>('loading');
  let message = $state('');
  let resendEmail = $state('');
  let resending = $state(false);
  let resendSuccess = $state(false);

  onMount(async () => {
    const token = getQueryParam('token');
    if (!token) {
      status = 'error';
      message = 'Tautan verifikasi tidak memiliki token atau sudah kedaluwarsa.';
      return;
    }
    try {
      await api.get<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`);
      status = 'success';
      setTimeout(() => push('/login'), 2500);
    } catch (e) {
      status = 'error';
      message = e instanceof Error ? e.message : 'Tautan verifikasi tidak valid atau telah kedaluwarsa.';
    }
  });

  async function handleResendEmail(e: Event) {
    e.preventDefault();
    if (!resendEmail || resending) return;
    resending = true;
    try {
      await api.post('/auth/resend-verification', { email: resendEmail });
      resendSuccess = true;
      showToast('Tautan verifikasi baru berhasil dikirim!', 'success');
    } catch (err) {
      showToast((err as Error).message || 'Gagal mengirim ulang email verifikasi', 'error');
    } finally {
      resending = false;
    }
  }
</script>

<AuthLayout
  title={status === 'success'
    ? 'Email Berhasil Diverifikasi'
    : status === 'error'
      ? 'Verifikasi Email Diperlukan'
      : 'Memproses Verifikasi'}
  subtitle={status === 'success'
    ? 'Akun kamu kini siap digunakan sepenuhnya.'
    : status === 'error'
      ? 'Selesaikan langkah verifikasi untuk mulai bertransaksi.'
      : 'Tunggu sebentar, kami sedang memvalidasi akun kamu.'}
>
  {#if status === 'loading'}
    <div class="py-8">
      <Loading text="Memverifikasi email kamu..." />
    </div>
  {:else if status === 'success'}
    <div class="flex flex-col items-center gap-4 py-6 text-center">
      <div
        class="flex h-14 w-14 items-center justify-center rounded-2xl border border-success/30 bg-success/10 text-success ring-8 ring-success/5"
      >
        <Icon name="check" size={26} />
      </div>
      <div class="space-y-1">
        <h4 class="text-base font-semibold text-text">Verifikasi Berhasil!</h4>
        <p class="text-sm text-muted">
          Email kamu sudah terverifikasi. Mengalihkan ke dashboard...
        </p>
      </div>
      <div class="mt-2 w-full max-w-xs">
        <Button block onclick={() => push('/login')}>Masuk Sekarang</Button>
      </div>
    </div>
  {:else}
    <div class="flex flex-col items-start gap-4">
      <div
        class="flex h-12 w-12 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent"
      >
        <Icon name="mail" size={24} />
      </div>
      
      <div class="space-y-1 text-left">
        <p class="text-sm font-medium text-text">{message}</p>
        <p class="text-xs text-muted">
          Jika tautan lama sudah kedaluwarsa atau belum menerima email, masukkan alamat email kamu di bawah untuk mendapatkan tautan baru.
        </p>
      </div>

      {#if resendSuccess}
        <div class="w-full rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success">
          Tautan verifikasi baru telah dikirimkan ke <strong>{resendEmail}</strong>. Silakan periksa kotak masuk atau spam.
        </div>
      {:else}
        <form onsubmit={handleResendEmail} class="w-full space-y-3">
          <Input
            id="resend-email"
            label="Alamat Email Akun"
            type="email"
            placeholder="nama@email.com"
            bind:value={resendEmail}
            required
          />
          <Button type="submit" block disabled={resending || !resendEmail}>
            {#if resending}
              Mengirim...
            {:else}
              Kirim Ulang Tautan Verifikasi
            {/if}
          </Button>
        </form>
      {/if}

      <div class="w-full border-t border-border pt-3">
        <Button variant="secondary" block onclick={() => push('/login')}>
          Kembali ke Halaman Masuk
        </Button>
      </div>
    </div>
  {/if}
</AuthLayout>
