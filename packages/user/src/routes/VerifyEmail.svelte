<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import { getQueryParam } from '../lib/query';
  import AuthLayout from '../components/layout/AuthLayout.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import Button from '../components/ui/Button.svelte';
  import Icon from '../components/ui/Icon.svelte';

  let status = $state<'loading' | 'success' | 'error'>('loading');
  let message = $state('');

  onMount(async () => {
    const token = getQueryParam('token');
    if (!token) {
      status = 'error';
      message = 'Token verifikasi tidak ditemukan.';
      return;
    }
    try {
      await api.get<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`);
      status = 'success';
      setTimeout(() => push('/login'), 2000);
    } catch (e) {
      status = 'error';
      message = e instanceof Error ? e.message : 'Terjadi kesalahan';
    }
  });
</script>

<AuthLayout
  title={status === 'success' ? 'Email Terverifikasi' : status === 'error' ? 'Verifikasi Gagal' : 'Verifikasi Email'}
>
  {#if status === 'loading'}
    <Loading text="Memverifikasi email..." />
  {:else if status === 'success'}
    <div class="flex flex-col items-start gap-3">
      <div
        class="flex h-11 w-11 items-center justify-center rounded-[10px] border border-success/30 bg-success/10 text-success"
      >
        <Icon name="check" size={20} />
      </div>
      <p class="text-sm text-muted">Email kamu sudah aktif. Mengalihkan ke halaman login...</p>
    </div>
  {:else}
    <div class="flex flex-col items-start gap-3">
      <div
        class="flex h-11 w-11 items-center justify-center rounded-[10px] border border-error/30 bg-error/10 text-error"
      >
        <Icon name="alert" size={20} />
      </div>
      <p class="text-sm text-muted">{message}</p>
      <Button block onclick={() => push('/login')}>Ke Halaman Login</Button>
    </div>
  {/if}
</AuthLayout>
