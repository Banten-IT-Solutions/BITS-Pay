<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { auth } from '../stores/auth';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast';
  import AuthLayout from '../components/layout/AuthLayout.svelte';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';

  let mode = $state<'login' | 'signup'>('login');
  let loading = $state(false);
  let name = $state('');
  let email = $state('');
  let password = $state('');
  let error = $state('');

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
  title={mode === 'login' ? 'Masuk ke dashboard' : 'Buat akun baru'}
  subtitle={mode === 'login'
    ? 'Kelola pembayaran QRIS aplikasi kamu.'
    : 'Gratis untuk mulai — upgrade kapan saja.'}
>
  {#if error}
    <div
      class="mb-4 rounded-lg border border-error/30 bg-error/10 px-3.5 py-2.5 text-sm text-error"
      role="alert"
    >
      {error}
    </div>
  {/if}

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
