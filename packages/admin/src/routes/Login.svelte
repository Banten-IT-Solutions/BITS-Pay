<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { auth } from '../stores/auth';
  import { showToast } from '../lib/toast';
  import Button from '../components/ui/Button.svelte';
  import Card from '../components/ui/Card.svelte';

  let loading = $state(false);
  let email = $state('');
  let password = $state('');
  let error = $state('');

  async function handleSubmit() {
    error = '';
    loading = true;
    try {
      await auth.login(email, password);
      showToast('Selamat datang admin!', 'success');
      push('/');
    } catch (e: any) {
      error = e.message || 'Login gagal';
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
  <Card>
    <div class="w-full max-w-sm">
      <div class="mb-6 text-center">
        <h2 class="text-2xl font-bold text-primary-500">Admin Panel</h2>
        <p class="mt-1 text-sm text-neutral-400">Masuk ke panel admin</p>
      </div>

      {#if error}
        <div class="mb-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</div>
      {/if}

      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-neutral-600">Email</label>
          <input type="email" value={email} oninput={(e) => email = (e.target as HTMLInputElement).value} class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" required />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-neutral-600">Password</label>
          <input type="password" value={password} oninput={(e) => password = (e.target as HTMLInputElement).value} class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" required />
        </div>
        <Button type="submit" block loading={loading}>Masuk</Button>
      </form>
    </div>
  </Card>
</div>