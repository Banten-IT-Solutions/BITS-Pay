<script lang="ts">
  import { onMount } from 'svelte';
  import { push, router } from 'svelte-spa-router';
  import Router from 'svelte-spa-router';
  import routes from './routes';
  import { auth } from './stores/auth';
  import { api } from './lib/api';
  import DashboardLayout from './components/layout/DashboardLayout.svelte';
  import OnboardingWizard from './components/OnboardingWizard.svelte';
  import Toast from './components/ui/Toast.svelte';
  import Loading from './components/ui/Loading.svelte';
  import type { RouteDetailLoaded } from 'svelte-spa-router';
  import type { WorkspaceWithMemberCount } from '@bits-pay/shared';

  let initialized = $state(false);
  let showOnboarding = $state(false);

  const PUBLIC_PATHS = [
    '/login',
    '/auth/callback',
    '/verify-email',
    '/reset-password',
    '/forgot-password',
  ];

  onMount(async () => {
    await auth.init();
    initialized = true;
    if (!$auth.token && !PUBLIC_PATHS.includes(router.location)) {
      push('/login');
    }
    // Onboarding wizard: hanya untuk user baru tanpa workspace & belum pernah skip/selesai.
    if ($auth.token && !localStorage.getItem('onboarding-done')) {
      try {
        const list = await api.get<WorkspaceWithMemberCount[]>('/app/workspaces');
        if (list.length === 0) showOnboarding = true;
      } catch {
        // Gagal fetch bukan penghalang — dashboard tetap jalan.
      }
    }
  });

  function handleRouteLoaded(detail: RouteDetailLoaded) {
    if (!initialized) return;
    if (!$auth.token && !PUBLIC_PATHS.includes(detail.location)) {
      push('/login');
    }
  }
</script>

<Toast />
{#if !initialized}
  <div class="flex h-dvh items-center justify-center bg-bg">
    <Loading text="Memuat..." />
  </div>
{:else if $auth.token}
  <DashboardLayout>
    <Router {routes} onRouteLoaded={handleRouteLoaded} />
  </DashboardLayout>
  <OnboardingWizard open={showOnboarding} onClose={() => (showOnboarding = false)} />
{:else}
  <Router {routes} onRouteLoaded={handleRouteLoaded} />
{/if}
