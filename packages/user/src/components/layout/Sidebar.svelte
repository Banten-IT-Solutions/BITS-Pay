<script lang="ts">
  import { router, push } from 'svelte-spa-router';
  import { auth } from '../../stores/auth';
  import Icon, { type IconName } from '../ui/Icon.svelte';
  import BrandMark from '../ui/BrandMark.svelte';
  import Badge from '../ui/Badge.svelte';

  interface Props {
    onNavigate?: () => void;
  }
  let { onNavigate }: Props = $props();

  const links: { href: string; icon: IconName; label: string }[] = [
    { href: '/', icon: 'overview', label: 'Overview' },
    { href: '/workspaces', icon: 'workspaces', label: 'Workspaces' },
    { href: '/apps', icon: 'apps', label: 'Apps' },
    { href: '/payments', icon: 'payments', label: 'Pembayaran' },
    { href: '/invoices', icon: 'invoices', label: 'Tagihan' },
    { href: '/subscription', icon: 'subscription', label: 'Langganan' },
    { href: '/profile', icon: 'user', label: 'Profil' },
  ];

  function isActive(href: string): boolean {
    const loc = router.location;
    return href === '/' ? loc === '/' : loc.startsWith(href);
  }

  function logout() {
    auth.logout();
    onNavigate?.();
    push('/login');
  }
</script>

<div class="flex h-full w-full flex-col bg-surface">
  <a
    href="#/"
    class="flex h-14 flex-none items-center gap-2.5 border-b border-border px-4"
    onclick={onNavigate}
    aria-label="BITS Pay — ke Overview"
  >
    <BrandMark size={22} />
    <span class="font-display text-[17px] font-bold tracking-tight text-text">BITS Pay</span>
    <span class="font-mono text-[10px] font-medium tracking-[0.12em] text-faint uppercase">// dash</span>
  </a>

  <nav class="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Navigasi utama">
    {#each links as link (link.href)}
      {@const active = isActive(link.href)}
      <a
        href="#{link.href}"
        onclick={onNavigate}
        aria-current={active ? 'page' : undefined}
        class="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 {active
          ? 'bg-accent-soft text-accent'
          : 'text-muted hover:bg-surface-2 hover:text-text'}"
      >
        <Icon name={link.icon} size={18} class="flex-none" />
        <span>{link.label}</span>
      </a>
    {/each}
  </nav>

  <div class="flex-none space-y-3 border-t border-border p-3">
    {#if $auth.user}
      <div class="flex items-center justify-between gap-2 px-1">
        <span class="text-xs text-faint">Paket kamu</span>
        {#if $auth.user.tier === 'premium'}
          <Badge status="premium" dot={false} />
        {:else}
          <a
            href="#/subscription"
            onclick={onNavigate}
            class="text-xs font-semibold text-accent hover:text-accent-strong"
          >
            Upgrade →
          </a>
        {/if}
      </div>
    {/if}
    <button
      class="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
      onclick={logout}
    >
      <Icon name="logout" size={18} class="flex-none" />
      <span>Keluar</span>
    </button>
  </div>
</div>
