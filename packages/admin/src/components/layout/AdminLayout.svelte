<script lang="ts">
  import type { Snippet } from 'svelte';
  import { push, router } from 'svelte-spa-router';
  import { auth } from '../../stores/auth';

  let { children }: { children?: Snippet } = $props();
  let collapsed = $state(false);

  const links = [
    { href: '/', icon: '&#128202;', label: 'Overview' },
    { href: '/payments', icon: '&#128179;', label: 'Payments' },
    { href: '/review', icon: '&#128269;', label: 'Review Queue' },
    { href: '/users', icon: '&#128101;', label: 'Users' },
    { href: '/callbacks', icon: '&#128260;', label: 'Callbacks' },
    { href: '/audit-logs', icon: '&#128221;', label: 'Audit Logs' },
    { href: '/reports', icon: '&#128200;', label: 'Reports' },
    { href: '/tier-features', icon: '&#127912;', label: 'Tier Features' },
    { href: '/settings', icon: '&#9881;', label: 'Settings' },
  ];

  function isActive(href: string) {
    return router.location === href;
  }
</script>

<div class="flex h-screen">
  <aside class="flex h-full flex-col border-r border-neutral-100 bg-white transition-all" class:w-64={!collapsed} class:w-16={collapsed}>
    <div class="flex h-16 items-center gap-2 border-b border-neutral-100 px-4">
      <button class="text-xl" onclick={() => collapsed = !collapsed} aria-label="Toggle sidebar">&#9776;</button>
      {#if !collapsed}
        <span class="text-lg font-bold text-primary-500">Admin</span>
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
  <div class="flex flex-1 flex-col overflow-hidden">
    <header class="flex h-16 items-center justify-between border-b border-neutral-100 bg-white px-6">
      <h1 class="text-lg font-semibold text-neutral-900">Panel Admin</h1>
      {#if $auth.user}
        <span class="text-sm text-neutral-400">{$auth.user.name}</span>
      {/if}
    </header>
    <main class="flex-1 overflow-y-auto bg-neutral-50 p-6">
      {@render children?.()}
    </main>
  </div>
</div>