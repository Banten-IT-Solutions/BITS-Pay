<script lang="ts">
  import type { Snippet } from 'svelte';
  import { router } from 'svelte-spa-router';
  import Sidebar from './Sidebar.svelte';
  import Navbar from './Navbar.svelte';
  import Icon from '../ui/Icon.svelte';

  let { children }: { children?: Snippet } = $props();

  let drawerOpen = $state(false);
  let drawerEl = $state<HTMLDivElement | null>(null);

  // Tutup drawer setiap pindah route.
  $effect(() => {
    void router.location;
    drawerOpen = false;
  });

  $effect(() => {
    if (drawerOpen) requestAnimationFrame(() => drawerEl?.querySelector('a')?.focus());
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') drawerOpen = false;
  }}
/>

<div class="min-h-dvh bg-bg lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
  <aside class="sticky top-0 hidden h-dvh border-r border-border lg:block">
    <Sidebar />
  </aside>

  <div class="flex min-h-dvh min-w-0 flex-col">
    <Navbar onMenu={() => (drawerOpen = true)} />
    <main class="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div class="mx-auto w-full max-w-[1200px]">
        {@render children?.()}
      </div>
    </main>
  </div>

  {#if drawerOpen}
    <div class="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu navigasi">
      <button
        class="absolute inset-0 h-full w-full cursor-default bg-black/55 animate-[overlay-in_150ms_ease-out]"
        onclick={() => (drawerOpen = false)}
        aria-label="Tutup menu navigasi"
        tabindex="-1"
      ></button>
      <div
        bind:this={drawerEl}
        class="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col border-r border-border bg-surface animate-[drawer-in_200ms_ease-out]"
      >
        <button
          class="absolute top-3.5 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
          onclick={() => (drawerOpen = false)}
          aria-label="Tutup menu navigasi"
        >
          <Icon name="x" size={18} />
        </button>
        <Sidebar onNavigate={() => (drawerOpen = false)} />
      </div>
    </div>
  {/if}
</div>
