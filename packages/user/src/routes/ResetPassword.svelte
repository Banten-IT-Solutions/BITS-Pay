<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import { getQueryParam } from '../lib/query';
  import { showToast } from '../lib/toast';
  import AuthLayout from '../components/layout/AuthLayout.svelte';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';

  let token = $state('');
  let password = $state('');
  let loading = $state(false);
  let error = $state('');

  onMount(() => {
    token = getQueryParam('token') ?? '';
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

<AuthLayout title="Buat password baru" subtitle="Masukkan password baru untuk akun kamu.">
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
    <Input
      label="Password baru"
      type="password"
      value={password}
      oninput={(e) => (password = (e.target as HTMLInputElement).value)}
      required
    />
    <Button type="submit" block size="lg" loading={loading} disabled={!token}>
      Simpan password
    </Button>
  </form>

  {#snippet footer()}
    <button class="font-medium text-accent hover:text-accent-strong" onclick={() => push('/login')}>
      ← Kembali ke login
    </button>
  {/snippet}
</AuthLayout>
