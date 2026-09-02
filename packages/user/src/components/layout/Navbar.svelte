<script lang="ts">
  import { router } from 'svelte-spa-router';
  import { auth } from '../../stores/auth';

  const pageTitles: Record<string, string> = {
    '/': 'Overview',
    '/workspaces': 'Workspaces',
    '/login': 'Masuk',
    '/apps': 'Apps',
    '/payments': 'Pembayaran',
    '/subscription': 'Langganan',
  };

  function pageTitle() {
    const path = router.location;
    if (path in pageTitles) return pageTitles[path];
    if (path.startsWith('/workspaces/')) return 'Workspace';
    if (path.startsWith('/payments/')) return 'Detail Pembayaran';
    return 'Dashboard';
  }
</script>

<header class="flex h-16 items-center justify-between border-b border-neutral-100 bg-white px-6">
  <h1 class="text-lg font-semibold text-neutral-900">{pageTitle()}</h1>
  <div class="flex items-center gap-3">
    {#if $auth.user}
      <span class="text-sm text-neutral-400">{$auth.user.name}</span>
      <span class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-sm font-medium text-white">
        {$auth.user.name.charAt(0).toUpperCase()}
      </span>
    {/if}
  </div>
</header>