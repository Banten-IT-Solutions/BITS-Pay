<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { auth } from '../stores/auth';
  import Loading from '../components/ui/Loading.svelte';

  onMount(async () => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) {
      push('/login');
      return;
    }
    try {
      await auth.exchangeCode(code);
      push('/');
    } catch {
      push('/login');
    }
  });
</script>

<div class="flex h-dvh items-center justify-center bg-bg">
  <Loading text="Memproses login..." />
</div>
