<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { auth } from '../stores/auth';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';
  import Card from '../components/ui/Card.svelte';

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
</script>

<div class="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
  <Card padding={true}>
    <div class="w-full max-w-sm">
      <div class="mb-6 text-center">
        <h2 class="text-2xl font-bold text-primary-500">BITS Pay</h2>
        <p class="mt-1 text-sm text-neutral-400">{mode === 'login' ? 'Masuk ke dashboard' : 'Buat akun baru'}</p>
      </div>

      {#if error}
        <div class="mb-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</div>
      {/if}

      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
        {#if mode === 'signup'}
          <Input label="Nama" value={name} oninput={(e) => name = (e.target as HTMLInputElement).value} required />
        {/if}
        <Input label="Email" type="email" value={email} oninput={(e) => email = (e.target as HTMLInputElement).value} required />
        <Input label="Password" type="password" value={password} oninput={(e) => password = (e.target as HTMLInputElement).value} required />
        <Button type="submit" block loading={loading}>
          {mode === 'login' ? 'Masuk' : 'Daftar'}
        </Button>
      </form>

      <p class="mt-4 text-center text-sm text-neutral-400">
        {#if mode === 'login'}
          <button class="font-medium text-primary-500 hover:underline" onclick={() => push('/forgot-password')}>Lupa password?</button>
          <span class="mx-2">·</span>
          Belum punya akun?
          <button class="font-medium text-primary-500 hover:underline" onclick={() => { mode = 'signup'; error = ''; }}>Daftar</button>
        {:else}
          Sudah punya akun?
          <button class="font-medium text-primary-500 hover:underline" onclick={() => { mode = 'login'; error = ''; }}>Masuk</button>
        {/if}
      </p>
    </div>
  </Card>
</div>