<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';

  let token = $state('');
  let password = $state('');
  let loading = $state(false);
  let error = $state('');

  onMount(() => {
    token = new URLSearchParams(window.location.search).get('token') ?? '';
    if (!token) error = 'Token reset tidak ditemukan.';
  });

  async function handleSubmit() {
    if (!token) return;
    error = '';
    loading = true;
    try {
      await api.post('/auth/reset', { token, password });
      showToast('Password berhasil direset. Silakan login.', 'success');
      push('/login');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Terjadi kesalahan';
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
        <p class="mt-1 text-sm text-neutral-400">Buat password baru</p>
      </div>

      {#if error}
        <div class="mb-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</div>
      {/if}

      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
        <Input
          label="Password baru"
          type="password"
          value={password}
          oninput={(e) => password = (e.target as HTMLInputElement).value}
          required
        />
        <Button type="submit" block loading={loading} disabled={!token}>
          Simpan password
        </Button>
      </form>

      <p class="mt-4 text-center text-sm text-neutral-400">
        <button class="font-medium text-primary-500 hover:underline" onclick={() => push('/login')}>
          Kembali ke login
        </button>
      </p>
    </div>
  </Card>
</div>