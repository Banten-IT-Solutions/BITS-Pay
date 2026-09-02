<script lang="ts">
  import { push, router } from 'svelte-spa-router';
  import { auth } from '../../stores/auth';

  let collapsed = $state(false);

  const links = [
    { href: '/', icon: '&#128202;', label: 'Overview' },
    { href: '/workspaces', icon: '&#128193;', label: 'Workspaces' },
    { href: '/apps', icon: '&#129302;', label: 'Apps' },
    { href: '/payments', icon: '&#128179;', label: 'Payments' },
    { href: '/invoices', icon: '&#128196;', label: 'Invoices' },
    { href: '/subscription', icon: '&#128230;', label: 'Subscription' },
  ];

  function isActive(href: string) {
    return router.location === href;
  }
</script>

<aside class="flex h-full flex-col border-r border-neutral-100 bg-white transition-all" class:w-64={!collapsed} class:w-16={collapsed}>
  <div class="flex h-16 items-center gap-2 border-b border-neutral-100 px-4">
    <button class="text-xl" onclick={() => collapsed = !collapsed} aria-label="Toggle sidebar">&#9776;</button>
    {#if !collapsed}
      <span class="text-lg font-bold text-primary-500">BITS Pay</span>
    {/if}
  </div>
  <nav class="flex-1 space-y-1 p-2">
    {#each links as link}
      <button
        class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors {isActive(link.href) ? 'bg-primary-50 text-primary-600' : 'text-neutral-600 hover:bg-neutral-100'}"
        onclick={() => push(link.href)}
      >
        <span class="text-lg">{@html link.icon}</span>
        {#if !collapsed}
          <span>{link.label}</span>
        {/if}
      </button>
    {/each}
  </nav>
  <div class="border-t border-neutral-100 p-2">
    <button
      class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
      onclick={() => { auth.logout(); push('/login'); }}
    >
      <span class="text-lg">&#128682;</span>
      {#if !collapsed}
        <span>Keluar</span>
      {/if}
    </button>
  </div>
</aside>