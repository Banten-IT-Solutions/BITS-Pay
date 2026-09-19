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

  const features = [
    {
      title: 'QRIS dinamis + kode unik',
      desc: 'Tiap invoice otomatis punya kode unik 3-digit untuk identifikasi transfer instan.',
      tag: 'PAYMENT',
      icon: 'zap' as const,
    },
    {
      title: 'OCR konfirmasi otomatis',
      desc: 'Sistem membaca bukti struk / notifikasi mutasi secara cerdas dalam hitungan detik.',
      tag: 'VERIFY',
      icon: 'shield' as const,
    },
    {
      title: 'Callback dengan retry',
      desc: 'Webhook terkirim andal ke server kamu dengan tanda tangan HMAC dan exponential backoff.',
      tag: 'WEBHOOK',
      icon: 'refresh' as const,
    },
  ];
</script>

<div class="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
  <!-- Panel brand visual (Desktop) -->
  <div
    class="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-gradient-to-b from-surface via-surface to-surface-2 p-10 xl:p-12 lg:flex select-none"
  >
    <!-- Background grid dot & ambient glow -->
    <div
      class="pointer-events-none absolute inset-0 opacity-60 dark:opacity-40"
      style="background-image: radial-gradient(color-mix(in srgb, var(--accent) 18%, transparent) 1.2px, transparent 1.2px); background-size: 24px 24px; mask-image: radial-gradient(ellipse at 30% 20%, black 40%, transparent 80%); -webkit-mask-image: radial-gradient(ellipse at 30% 20%, black 40%, transparent 80%);"
      aria-hidden="true"
    ></div>
    <div
      class="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-accent/10 blur-3xl"
      aria-hidden="true"
    ></div>

    <!-- Top: Logo & Status Badge -->
    <div class="relative flex items-center justify-between">
      <a href="#/login" class="group flex items-center gap-3" aria-label="BITS Pay Home">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface shadow-xs transition-transform duration-200 group-hover:scale-105"
        >
          <BrandMark size={24} />
        </div>
        <div>
          <span class="font-display text-lg font-bold tracking-tight text-text block leading-none">BITS Pay</span>
          <span class="font-mono text-[10px] tracking-wider text-faint uppercase font-medium">Gateway Platform</span>
        </div>
      </a>
      <div
        class="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/80 px-2.5 py-1 text-[11px] font-medium text-muted backdrop-blur-xs shadow-2xs"
      >
        <span class="relative flex h-2 w-2">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
        </span>
        API Online
      </div>
    </div>

    <!-- Center: Main Value & Card Showcase -->
    <div class="relative my-auto py-8">
      <!-- Tag pill -->
      <div class="inline-flex items-center gap-2 rounded-lg border border-accent/20 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent mb-4">
        <span class="font-mono">// 01</span>
        <span>QRIS Payment Gateway</span>
      </div>

      <h2 class="font-display text-3xl xl:text-4xl leading-[1.15] font-bold tracking-tight text-text">
        Terima pembayaran QRIS.<br />
        <span class="bg-gradient-to-r from-accent via-accent to-accent-strong bg-clip-text text-transparent">
          Cepat, otomatis, tanpa repot.
        </span>
      </h2>

      <p class="mt-4 max-w-md text-sm leading-relaxed text-muted">
        Terima pembayaran QRIS dengan kode unik, konfirmasi otomatis via OCR, dan callback andal langsung ke backend aplikasimu.
      </p>

      <!-- Feature cards list -->
      <div class="mt-8 space-y-3">
        {#each features as f, i (f.title)}
          <div
            class="group relative flex items-start gap-3.5 rounded-xl border border-border/80 bg-surface/90 p-3.5 transition-all duration-200 hover:border-border-strong hover:bg-surface hover:shadow-xs backdrop-blur-xs"
          >
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-on-accent"
            >
              <Icon name={f.icon} size={18} />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-display text-sm font-semibold tracking-tight text-text leading-snug">
                  {f.title}
                </h3>
                <span class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] font-medium text-faint border border-border/50">
                  {f.tag}
                </span>
              </div>
              <p class="mt-0.5 text-xs text-muted leading-normal line-clamp-2">
                {f.desc}
              </p>
            </div>
          </div>
        {/each}
      </div>

      <!-- Quick Metrics Ribbon -->
      <div class="mt-8 grid grid-cols-3 gap-3 border-t border-border/80 pt-6">
        <div>
          <div class="font-mono text-base font-bold text-text num">99.9%</div>
          <div class="font-mono text-[11px] text-faint">Uptime SLA</div>
        </div>
        <div>
          <div class="font-mono text-base font-bold text-text num">&lt; 3 dtk</div>
          <div class="font-mono text-[11px] text-faint">Deteksi OCR</div>
        </div>
        <div>
          <div class="font-mono text-base font-bold text-text num">Rp 0</div>
          <div class="font-mono text-[11px] text-faint">Potongan Fee</div>
        </div>
      </div>
    </div>

    <!-- Bottom: Copyright & Legal info -->
    <div class="relative flex items-center justify-between border-t border-border/60 pt-5 text-xs text-faint">
      <p class="font-mono">&copy; 2026 BITS Pay &bull; Banten IT Solutions</p>
      <div class="flex items-center gap-4">
        <a href="/docs/" target="_blank" class="transition-colors hover:text-text">Docs API</a>
        <span class="text-border-strong">&bull;</span>
        <span class="inline-flex items-center gap-1">
          <Icon name="shield" size={12} />
          SSL Enkripsi
        </span>
      </div>
    </div>
  </div>

  <!-- Panel form (Interaktif) -->
  <div class="relative flex min-h-dvh flex-col bg-bg">
    <!-- Form top bar -->
    <div class="flex flex-none items-center justify-between p-4 sm:p-6 lg:justify-end">
      <a href="#/login" class="flex items-center gap-2.5 lg:hidden" aria-label="BITS Pay Home">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface shadow-2xs">
          <BrandMark size={20} />
        </div>
        <span class="font-display text-base font-bold tracking-tight text-text">BITS Pay</span>
      </a>

      <div class="flex items-center gap-2">
        <button
          class="flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-surface text-muted shadow-2xs transition-colors duration-150 hover:border-border-strong hover:bg-surface-2 hover:text-text"
          onclick={() => (theme = toggleTheme())}
          aria-label={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
          title="Ganti tema"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
        </button>
      </div>
    </div>

    <!-- Form container -->
    <div class="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
      <div class="w-full max-w-[400px]">
        <div class="mb-6">
          <h1 class="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text">{title}</h1>
          {#if subtitle}
            <p class="mt-1.5 text-sm text-muted">{subtitle}</p>
          {/if}
        </div>

        <div class="rounded-2xl border border-border/80 bg-surface p-6 sm:p-7 shadow-xs backdrop-blur-xs">
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
