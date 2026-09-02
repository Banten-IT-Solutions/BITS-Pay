<script lang="ts">
  import { onMount } from 'svelte';
  import { push, router } from 'svelte-spa-router';
  import Router from 'svelte-spa-router';
  import routes from './routes';
  import { auth } from './stores/auth';
  import AdminLayout from './components/layout/AdminLayout.svelte';
  import Toast from './components/ui/Toast.svelte';
  import Loading from './components/ui/Loading.svelte';
  import type { RouteDetailLoaded } from 'svelte-spa-router';

  let initialized = $state(false);

  onMount(async () => {
    await auth.init();
    initialized = true;
    if (!$auth.token && router.location !== '/login') {
      push('/login');
    }
  });

  function handleRouteLoaded(detail: RouteDetailLoaded) {
    if (!initialized) return;
    if (!$auth.token && detail.location !== '/login') {
      push('/login');
    }
  }
</script>

<Toast />
{#if !initialized}
  <div class="flex h-screen items-center justify-center">
    <Loading text="Memuat..." />
  </div>
{:else if $auth.token}
  <AdminLayout>
    <Router {routes} onRouteLoaded={handleRouteLoaded} />
  </AdminLayout>
{:else}
  <Router {routes} onRouteLoaded={handleRouteLoaded} />
{/if}