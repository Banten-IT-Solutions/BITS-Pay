<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { auth } from '../stores/auth';
  import { showToast } from '../lib/toast';
  import Loading from '../components/ui/Loading.svelte';

  onMount(async () => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashQuery = window.location.hash.includes('?')
      ? window.location.hash.split('?')[1]
      : '';
    const hashParams = new URLSearchParams(hashQuery);
    const code = searchParams.get('code') || hashParams.get('code');

    if (!code) {
      showToast('Kode autentikasi tidak ditemukan', 'error');
      push('/login');
      return;
    }
    try {
      await auth.exchangeCode(code);
      showToast('Berhasil masuk dengan Google', 'success');
      push('/');
    } catch (e) {
      showToast((e as Error).message || 'Gagal memproses login Google', 'error');
      push('/login');
    }
  });
</script>

<div class="flex h-dvh items-center justify-center bg-bg">
  <Loading text="Memproses login..." />
</div>
