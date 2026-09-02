<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import Card from '../components/ui/Card.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import Button from '../components/ui/Button.svelte';

  let status = $state<'loading' | 'success' | 'error'>('loading');
  let message = $state('');

  onMount(async () => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      status = 'error';
      message = 'Token verifikasi tidak ditemukan.';
      return;
    }
    try {
      await api.get<{ message: string }>(
        `/auth/verify-email?token=${encodeURIComponent(token)}`,
      );
      status = 'success';
      setTimeout(() => push('/login'), 2000);
    } catch (e) {
      status = 'error';
      message = e instanceof Error ? e.message : 'Terjadi kesalahan';
    }
  });
</script>

<div class="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
  <Card padding={true}>
    <div class="w-full max-w-sm text-center">
      {#if status === 'loading'}
        <Loading text="Memverifikasi email..." />
      {:else if status === 'success'}
        <h2 class="text-xl font-bold text-primary-500">Email terverifikasi!</h2>
        <p class="mt-2 text-sm text-neutral-600">Mengalihkan ke halaman login...</p>
      {:else}
        <h2 class="text-xl font-bold text-error">Verifikasi gagal</h2>
        <p class="mt-2 text-sm text-neutral-600">{message}</p>
        <div class="mt-4">
          <Button block onclick={() => push('/login')}>Ke halaman login</Button>
        </div>
      {/if}
    </div>
  </Card>
</div>