<script lang="ts">
  import type { Snippet } from 'svelte';
  import BrandMark from '../ui/BrandMark.svelte';
  import Icon from '../ui/Icon.svelte';
  import { getTheme, toggleTheme, type Theme } from '../../lib/theme';

  interface Props {
    title: string;
    subtitle?: string;
    children?: Snippet;
    footer?: Snippet;
  }
  let { title, subtitle = '', children, footer }: Props = $props();

  let theme = $state<Theme>(getTheme());

  const ticks = ['QRIS dinamis + kode unik', 'OCR konfirmasi otomatis', 'Callback dengan retry'];
</script>

<div class="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
  <!-- Panel brand — hanya desktop. -->
  <div
    class="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface p-10 lg:flex"
  >
    <div
      class="pointer-events-none absolute inset-0"
      style="background-image: radial-gradient(color-mix(in srgb, var(--text) 9%, transparent) 1px, transparent 1.5px); background-size: 26px 26px; mask-image: linear-gradient(to bottom, black 0%, transparent 75%); -webkit-mask-image: linear-gradient(to bottom, black 0%, transparent 75%);"
      aria-hidden="true"
    ></div>
    <a href="#/login" class="relative flex items-center gap-2.5" aria-label="BITS Pay">
      <BrandMark size={24} />
      <span class="font-display text-lg font-bold tracking-tight text-text">BITS Pay</span>
    </a>
    <div class="relative">
      <h2 class="font-display text-[28px] leading-tight font-semibold tracking-tight text-text">
        QRIS payment gateway<br />untuk aplikasi kamu.
      </h2>
      <p class="mt-3 max-w-sm text-sm text-muted">
        Terima pembayaran QRIS dengan kode unik, konfirmasi otomatis via OCR, dan callback andal.
      </p>
      <ul class="mt-6 space-y-2">
        {#each ticks as t (t)}
          <li class="flex items-center gap-2 font-mono text-[13px] text-muted">
            <span class="font-semibold text-accent">//</span>
            {t}
          </li>
        {/each}
      </ul>
    </div>
    <p class="relative font-mono text-xs text-faint">&copy; 2026 BITS Pay</p>
  </div>

  <!-- Panel form -->
  <div class="relative flex min-h-dvh flex-col bg-bg">
    <div class="flex flex-none items-center justify-between p-4 sm:p-6">
      <a href="#/login" class="flex items-center gap-2 lg:invisible" aria-label="BITS Pay">
        <BrandMark size={22} />
        <span class="font-display text-base font-bold tracking-tight text-text">BITS Pay</span>
      </a>
      <button
        class="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
        onclick={() => (theme = toggleTheme())}
        aria-label={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
        title="Ganti tema"
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </button>
    </div>

    <div class="flex flex-1 items-center justify-center px-4 pb-16 sm:px-6">
      <div class="w-full max-w-[380px]">
        <h1 class="font-display text-2xl font-semibold tracking-tight text-text">{title}</h1>
        {#if subtitle}
          <p class="mt-1.5 text-sm text-muted">{subtitle}</p>
        {/if}
        <div class="mt-6">
          {@render children?.()}
        </div>
        {#if footer}
          <div class="mt-6 text-center text-sm text-muted">
            {@render footer()}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
