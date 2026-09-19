<script lang="ts">
  import type { Snippet } from 'svelte';
  import { push, router } from 'svelte-spa-router';
  import { auth } from '../../stores/auth';
  import Icon, { type IconName } from '../ui/Icon.svelte';
  import BrandMark from '../ui/BrandMark.svelte';

  let { children }: { children?: Snippet } = $props();

  let drawerOpen = $state(false);
  let drawerEl = $state<HTMLElement | null>(null);

  interface NavLink {
    href: string;
    icon: IconName;
    label: string;
  }
  interface NavGroup {
    title: string;
    items: NavLink[];
  }

  const groups: NavGroup[] = [
    {
      title: 'Operasi',
      items: [
        { href: '/', icon: 'overview', label: 'Overview' },
        { href: '/payments', icon: 'payments', label: 'Payments' },
        { href: '/review', icon: 'review', label: 'Review Queue' },
      ],
    },
    {
      title: 'Data',
      items: [
        { href: '/users', icon: 'users', label: 'Users' },
        { href: '/callbacks', icon: 'callbacks', label: 'Callbacks' },
        { href: '/audit-logs', icon: 'audit', label: 'Audit Logs' },
      ],
    },
    {
      title: 'Sistem',
      items: [
        { href: '/reports', icon: 'reports', label: 'Reports' },
        { href: '/tier-features', icon: 'tier', label: 'Tier Features' },
        { href: '/settings', icon: 'settings', label: 'Settings' },
      ],
    },
  ];

  const titles: [string, string][] = [
    ['/payments/', 'Detail Transaksi'],
    ['/payments', 'Payments'],
    ['/review', 'Review Queue'],
    ['/users', 'Users'],
    ['/callbacks', 'Callbacks'],
    ['/audit-logs', 'Audit Logs'],
    ['/reports', 'Reports'],
    ['/tier-features', 'Tier Features'],
    ['/settings', 'Settings'],
    ['/', 'Overview'],
  ];
  const pageTitle = $derived(
    titles.find(([prefix]) =>
      prefix === '/' ? router.location === '/' : router.location.startsWith(prefix),
    )?.[1] ?? 'Admin',
  );

  function isActive(href: string) {
    return href === '/' ? router.location === '/' : router.location.startsWith(href);
  }

  function go(href: string) {
    drawerOpen = false;
    push(href);
  }

  function logout() {
    drawerOpen = false;
    auth.logout();
    push('/login');
  }

  // Fokus masuk drawer saat dibuka (aksesibilitas keyboard)
  $effect(() => {
    if (drawerOpen && drawerEl) {
      drawerEl.querySelector<HTMLElement>('button, a')?.focus();
    }
  });
</script>

{#snippet navItems()}
  {#each groups as group (group.title)}
    <div class="px-3 pt-5 pb-1.5 first:pt-2">
      <p class="hidden px-2 font-mono text-[10px] font-medium tracking-[0.14em] text-ink-400/70 uppercase lg:block">
        {group.title}
      </p>
    </div>
    {#each group.items as link (link.href)}
      <button
        type="button"
        class="group relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors lg:min-h-9 {isActive(link.href)
          ? 'bg-ink-800 text-white'
          : 'text-ink-400 hover:bg-ink-900 hover:text-white'}"
        title={link.label}
        aria-current={isActive(link.href) ? 'page' : undefined}
        onclick={() => go(link.href)}
      >
        {#if isActive(link.href)}
          <span class="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r bg-accent-500"></span>
        {/if}
        <Icon name={link.icon} size={19} class="flex-none" />
        <span class="hidden truncate lg:inline">{link.label}</span>
      </button>
    {/each}
  {/each}
{/snippet}

{#snippet navFooter()}
  <div class="border-t border-ink-800 p-2">
    {#if $auth.user}
      <div class="mb-1 hidden items-center gap-3 rounded-lg px-3 py-2 lg:flex">
        <span class="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
          {$auth.user.name.slice(0, 1).toUpperCase()}
        </span>
        <div class="min-w-0">
          <p class="truncate text-[13px] font-medium text-white">{$auth.user.name}</p>
          <p class="truncate font-mono text-[11px] text-ink-400">admin</p>
        </div>
      </div>
    {/if}
    <button
      type="button"
      class="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-400 transition-colors hover:bg-ink-900 hover:text-white lg:min-h-9"
      title="Keluar"
      onclick={logout}
    >
      <Icon name="logout" size={19} class="flex-none" />
      <span class="hidden lg:inline">Keluar</span>
    </button>
  </div>
{/snippet}

<div class="flex h-dvh">
  <!-- Sidebar: rail ikon (tablet sm–lg), penuh (desktop ≥lg), tersembunyi di mobile -->
  <aside
    class="hidden h-full w-[68px] flex-none flex-col bg-ink-950 sm:flex lg:w-60"
    aria-label="Navigasi admin"
  >
    <div class="flex h-14 flex-none items-center gap-2.5 border-b border-ink-800 px-4">
      <BrandMark size={24} />
      <div class="hidden leading-tight lg:block">
        <p class="text-sm font-bold text-white">BITS Pay</p>
        <p class="font-mono text-[10px] tracking-[0.12em] text-ink-400 uppercase">Admin</p>
      </div>
    </div>
    <nav class="flex-1 overflow-y-auto p-2" aria-label="Menu utama">
      {@render navItems()}
    </nav>
    {@render navFooter()}
  </aside>

  <!-- Drawer mobile (<sm) -->
  {#if drawerOpen}
    <div
      class="fixed inset-0 z-50 sm:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menu navigasi"
      tabindex="-1"
      onkeydown={(e) => {
        if (e.key === 'Escape') drawerOpen = false;
      }}
    >
      <button
        type="button"
        class="animate-fade-in absolute inset-0 h-full w-full cursor-default bg-ink-950/60"
        aria-label="Tutup menu"
        onclick={() => (drawerOpen = false)}
      ></button>
      <div
        bind:this={drawerEl}
        class="animate-drawer-in absolute inset-y-0 left-0 flex w-64 flex-col bg-ink-950 shadow-xl"
      >
        <div class="flex h-14 flex-none items-center justify-between border-b border-ink-800 px-4">
          <div class="flex items-center gap-2.5">
            <BrandMark size={24} />
            <div class="leading-tight">
              <p class="text-sm font-bold text-white">BITS Pay</p>
              <p class="font-mono text-[10px] tracking-[0.12em] text-ink-400 uppercase">Admin</p>
            </div>
          </div>
          <button
            type="button"
            class="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-900 hover:text-white"
            aria-label="Tutup menu"
            onclick={() => (drawerOpen = false)}
          >
            <Icon name="x" size={20} />
          </button>
        </div>
        <!-- Di drawer mobile, label selalu terlihat -->
        <nav class="flex-1 overflow-y-auto p-2 [&_.hidden]:block" aria-label="Menu utama">
          {@render navItems()}
        </nav>
        <div class="[&_.hidden]:flex">
          {@render navFooter()}
        </div>
      </div>
    </div>
  {/if}

  <!-- Kolom konten -->
  <div class="flex min-w-0 flex-1 flex-col">
    <!-- Topbar mobile -->
    <header class="flex h-14 flex-none items-center gap-2 border-b border-neutral-200 bg-white px-3 sm:hidden">
      <button
        type="button"
        class="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
        aria-label="Buka menu"
        aria-expanded={drawerOpen}
        onclick={() => (drawerOpen = true)}
      >
        <Icon name="menu" size={20} />
      </button>
      <h1 class="min-w-0 flex-1 truncate text-[15px] font-semibold text-neutral-900">{pageTitle}</h1>
      {#if $auth.user}
        <span class="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white" aria-label={$auth.user.name}>
          {$auth.user.name.slice(0, 1).toUpperCase()}
        </span>
      {/if}
    </header>

    <!-- Header desktop/tablet -->
    <header class="hidden h-14 flex-none items-center justify-between border-b border-neutral-200 bg-white px-6 sm:flex">
      <h1 class="text-[15px] font-semibold text-neutral-900">{pageTitle}</h1>
      {#if $auth.user}
        <span class="text-[13px] text-neutral-600">{$auth.user.name}</span>
      {/if}
    </header>

    <main class="flex-1 overflow-y-auto p-4 sm:p-6">
      <div class="mx-auto w-full max-w-7xl">
        {@render children?.()}
      </div>
    </main>
  </div>
</div>
