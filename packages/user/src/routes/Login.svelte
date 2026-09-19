<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { auth } from '../stores/auth';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast';
  import AuthLayout from '../components/layout/AuthLayout.svelte';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';
  import Icon from '../components/ui/Icon.svelte';

  const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:7001`;

  let mode = $state<'login' | 'signup'>('login');
  let loading = $state(false);
  let resending = $state(false);
  let name = $state('');
  let email = $state('');
  let password = $state('');
  let error = $state('');

  function handleGoogleAuth() {
    window.location.href = `${API_URL}/auth/google`;
  }

  async function handleResendFromLogin() {
    if (!email || resending) return;
    resending = true;
    try {
      await api.post('/auth/resend-verification', { email });
      showToast('Tautan verifikasi baru berhasil dikirim ke email Anda!', 'success');
      error = '';
    } catch (e) {
      showToast((e as Error).message || 'Gagal mengirim ulang email verifikasi', 'error');
    } finally {
      resending = false;
    }
  }

  async function handleSubmit() {
    error = '';
    loading = true;
    try {
      if (mode === 'login') {
        await auth.login(email, password);
        showToast('Selamat datang kembali!', 'success');
        push('/');
      } else {
        await api.post('/auth/signup', { name, email, password });
        showToast('Cek email kamu untuk verifikasi, lalu masuk.', 'success');
        mode = 'login';
        error = '';
      }
    } catch (e) {
      error = (e as Error).message || 'Terjadi kesalahan';
    } finally {
      loading = false;
    }
  }

  function switchMode(next: 'login' | 'signup') {
    mode = next;
    error = '';
  }
</script>

<AuthLayout
  title={mode === 'login' ? 'Masuk ke Dashboard' : 'Buat Akun Baru'}
  subtitle={mode === 'login'
    ? 'Kelola pembayaran QRIS aplikasi kamu.'
    : 'Gratis untuk mulai — upgrade kapan saja.'}
>
  {#if error}
    {#if /verifikasi email/i.test(error)}
      <div
        class="mb-4 rounded-xl border border-accent/30 bg-accent/10 p-3.5 text-left"
        role="alert"
      >
        <div class="flex items-center gap-2 font-medium text-accent">
          <Icon name="mail" size={16} />
          <span class="text-sm">Verifikasi Email Diperlukan</span>
        </div>
        <p class="mt-1.5 text-xs leading-relaxed text-muted">
          Akun kamu telah terdaftar tetapi belum diverifikasi. Buka kotak masuk email kamu atau kirim ulang tautan verifikasi.
        </p>
        <div class="mt-2.5">
          <button
            type="button"
            class="text-xs font-semibold text-accent hover:underline cursor-pointer"
            onclick={handleResendFromLogin}
            disabled={resending || !email}
          >
            {resending ? 'Mengirim...' : 'Kirim Ulang Email Verifikasi'}
          </button>
        </div>
      </div>
    {:else}
      <div
        class="mb-4 rounded-lg border border-error/30 bg-error/10 px-3.5 py-2.5 text-sm text-error"
        role="alert"
      >
        {error}
      </div>
    {/if}
  {/if}

  <Button
    type="button"
    variant="secondary"
    block
    size="lg"
    onclick={handleGoogleAuth}
    class="mb-4"
  >
    <svg viewBox="0 0 24 24" class="h-4.5 w-4.5 flex-none" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
    <span>{mode === 'login' ? 'Masuk dengan Google' : 'Daftar dengan Google'}</span>
  </Button>

  <div class="relative mb-4 flex items-center justify-center">
    <div class="absolute inset-0 flex items-center">
      <div class="w-full border-t border-border"></div>
    </div>
    <span class="relative bg-surface px-2.5 text-xs text-faint">
      {mode === 'login' ? 'atau masuk dengan email' : 'atau daftar dengan email'}
    </span>
  </div>

  <form
    onsubmit={(e) => {
      e.preventDefault();
      handleSubmit();
    }}
    class="space-y-4"
  >
    {#if mode === 'signup'}
      <Input
        label="Nama"
        value={name}
        oninput={(e) => (name = (e.target as HTMLInputElement).value)}
        required
      />
    {/if}
    <Input
      label="Email"
      type="email"
      value={email}
      oninput={(e) => (email = (e.target as HTMLInputElement).value)}
      required
    />
    <Input
      label="Password"
      type="password"
      value={password}
      oninput={(e) => (password = (e.target as HTMLInputElement).value)}
      required
    />
    <Button type="submit" block size="lg" loading={loading}>
      {mode === 'login' ? 'Masuk' : 'Daftar'}
    </Button>
  </form>

  {#snippet footer()}
    {#if mode === 'login'}
      <button
        class="font-medium text-accent hover:text-accent-strong"
        onclick={() => push('/forgot-password')}
      >
        Lupa password?
      </button>
      <span class="mx-2 text-faint">·</span>
      <span>Belum punya akun?</span>
      <button class="font-medium text-accent hover:text-accent-strong" onclick={() => switchMode('signup')}>
        Daftar
      </button>
    {:else}
      <span>Sudah punya akun?</span>
      <button class="font-medium text-accent hover:text-accent-strong" onclick={() => switchMode('login')}>
        Masuk
      </button>
    {/if}
  {/snippet}
</AuthLayout>
