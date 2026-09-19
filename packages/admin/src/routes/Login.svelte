<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { auth } from '../stores/auth';
  import { showToast } from '../lib/toast';
  import Button from '../components/ui/Button.svelte';
  import BrandMark from '../components/ui/BrandMark.svelte';
  import Icon from '../components/ui/Icon.svelte';

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
    } catch (e) {
      error = (e as Error).message || 'Login gagal';
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex min-h-dvh items-center justify-center bg-ink-950 p-4">
  <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl sm:p-8">
    <div class="mb-6 flex flex-col items-center text-center">
      <BrandMark size={36} />
      <h1 class="mt-3 text-xl font-bold text-neutral-900">BITS Pay Admin</h1>
      <p class="mt-1 flex items-center gap-1.5 text-[13px] text-neutral-600">
        <Icon name="shield" size={13} />
        Area khusus administrator
      </p>
    </div>

    {#if error}
      <div class="mb-4 flex items-start gap-2 rounded-lg bg-error/10 px-3.5 py-2.5 text-[13px] font-medium text-error" role="alert">
        <span class="mt-0.5 flex-none"><Icon name="alert" size={14} /></span>
        {error}
      </div>
    {/if}

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
      <div>
        <label for="admin-email" class="label">Email</label>
        <input
          id="admin-email"
          type="email"
          autocomplete="username"
          value={email}
          oninput={(e) => (email = (e.target as HTMLInputElement).value)}
          class="input"
          required
        />
      </div>
      <div>
        <label for="admin-password" class="label">Password</label>
        <input
          id="admin-password"
          type="password"
          autocomplete="current-password"
          value={password}
          oninput={(e) => (password = (e.target as HTMLInputElement).value)}
          class="input"
          required
        />
      </div>
      <Button type="submit" block loading={loading}>Masuk</Button>
    </form>
  </div>
</div>
