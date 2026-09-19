<script lang="ts">
  import { router, push } from 'svelte-spa-router';
  import { auth } from '../../stores/auth';
  import { getTheme, toggleTheme, type Theme } from '../../lib/theme';
  import Icon from '../ui/Icon.svelte';

  interface Props {
    onMenu?: () => void;
  }
  let { onMenu }: Props = $props();

  let theme = $state<Theme>(getTheme());
  let menuOpen = $state(false);
  let menuEl = $state<HTMLDivElement | null>(null);

  const pageTitles: Record<string, string> = {
    '/': 'Overview',
    '/workspaces': 'Workspaces',
    '/apps': 'Apps',
    '/payments': 'Pembayaran',
    '/invoices': 'Tagihan',
    '/subscription': 'Langganan',
    '/profile': 'Profil Akun',
    '/login': 'Masuk',
  };

  const pageSubtitles: Record<string, string> = {
    '/profile': 'Kelola identitas akun, kredensial, dan preferensi keamanan kamu.',
  };

  let title = $derived.by(() => {
    const path = router.location;
    if (path in pageTitles) return pageTitles[path];
    if (path.startsWith('/workspaces/')) return 'Detail Workspace';
    if (path.startsWith('/payments/')) return 'Detail Pembayaran';
    return 'Dashboard';
  });

  let subtitle = $derived.by(() => {
    const path = router.location;
    if (path in pageSubtitles) return pageSubtitles[path];
    return '';
  });

  function switchTheme() {
    theme = toggleTheme();
  }

  function logout() {
    menuOpen = false;
    auth.logout();
    push('/login');
  }
</script>

<svelte:window
  onclick={(e) => {
    if (menuOpen && menuEl && !menuEl.contains(e.target as Node)) menuOpen = false;
  }}
  onkeydown={(e) => {
    if (e.key === 'Escape') menuOpen = false;
  }}
/>

<header
  class="sticky top-0 z-40 flex h-14 flex-none items-center justify-between gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur-sm sm:px-6"
>
  <div class="flex min-w-0 items-center gap-2">
    <button
      class="flex h-10 w-10 flex-none items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text lg:hidden"
      onclick={onMenu}
      aria-label="Buka menu navigasi"
    >
      <Icon name="menu" size={20} />
    </button>
    <div class="flex min-w-0 items-baseline gap-2">
      <h1 class="truncate font-display text-[15px] font-semibold tracking-tight text-text sm:text-base">
        {title}
      </h1>
      {#if subtitle}
        <span
          class="hidden truncate font-mono text-[10px] font-medium tracking-[0.12em] text-faint uppercase sm:inline"
        >
          // {subtitle}
        </span>
      {/if}
    </div>
  </div>

  <div class="flex flex-none items-center gap-1.5">
    <button
      class="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
      onclick={switchTheme}
      aria-label={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
      title="Ganti tema"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>

    {#if $auth.user}
      <div class="relative" bind:this={menuEl}>
        <button
          class="flex h-10 items-center gap-2.5 rounded-lg px-2 transition-colors duration-150 hover:bg-surface-2"
          onclick={() => (menuOpen = !menuOpen)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Menu pengguna"
        >
          <span
            class="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent"
          >
            {$auth.user.name.charAt(0).toUpperCase()}
          </span>
          <span class="hidden max-w-[140px] truncate text-left text-sm font-medium text-text md:block">
            {$auth.user.name}
          </span>
        </button>

        {#if menuOpen}
          <div
            class="absolute right-0 top-full mt-1.5 w-60 rounded-[10px] border border-border bg-surface p-1.5 shadow-overlay animate-[panel-in_150ms_ease-out]"
            role="menu"
          >
            <div class="border-b border-border px-3 py-2.5">
              <p class="truncate text-sm font-semibold text-text">{$auth.user.name}</p>
              <p class="truncate text-xs text-faint">{$auth.user.email}</p>
            </div>
            <a
              href="#/profile"
              class="mt-1 flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
              onclick={() => (menuOpen = false)}
              role="menuitem"
            >
              <Icon name="user" size={16} />
              Profil Akun
            </a>
            <button
              class="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
              onclick={logout}
              role="menuitem"
            >
              <Icon name="logout" size={16} />
              Keluar
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</header>
