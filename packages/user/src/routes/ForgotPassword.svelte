<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import Card from '../components/ui/Card.svelte';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';

  let email = $state('');
  let loading = $state(false);
  let sent = $state(false);
  let error = $state('');

  async function handleSubmit() {
    error = '';
    loading = true;
    try {
      await api.post('/auth/forgot-password', { email });
      sent = true;
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
        <p class="mt-1 text-sm text-neutral-400">Lupa password</p>
      </div>

      {#if sent}
        <p class="text-sm text-neutral-600">
          Jika email terdaftar, link reset password telah dikirim. Periksa inbox kamu.
        </p>
        <div class="mt-4">
          <Button block onclick={() => push('/login')}>Kembali ke login</Button>
        </div>
      {:else}
        {#if error}
          <div class="mb-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</div>
        {/if}

        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            oninput={(e) => email = (e.target as HTMLInputElement).value}
            required
          />
          <Button type="submit" block loading={loading}>Kirim link reset</Button>
        </form>

        <p class="mt-4 text-center text-sm text-neutral-400">
          <button class="font-medium text-primary-500 hover:underline" onclick={() => push('/login')}>
            Kembali ke login
          </button>
        </p>
      {/if}
    </div>
  </Card>
</div>