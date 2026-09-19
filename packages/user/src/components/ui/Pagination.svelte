<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    page: number;
    perPage: number;
    total: number;
    onPageChange?: (page: number) => void;
  }
  let { page, perPage, total, onPageChange }: Props = $props();

  const totalPages = $derived(Math.max(1, Math.ceil(total / perPage)));

  // Jendela nomor halaman: 1 … c-1 c c+1 … N
  const pages = $derived.by<{ v: number | '…'; k: string }[]>(() => {
    const n = totalPages;
    const nums = n <= 7 ? Array.from({ length: n }, (_, i) => i + 1) : null;
    const list =
      nums ??
      [...new Set([1, n, page - 1, page, page + 1])]
        .filter((p) => p >= 1 && p <= n)
        .sort((a, b) => a - b);
    const out: { v: number | '…'; k: string }[] = [];
    for (let i = 0; i < list.length; i++) {
      if (i > 0 && list[i] - list[i - 1] > 1) out.push({ v: '…', k: `gap-${list[i]}` });
      out.push({ v: list[i], k: `p-${list[i]}` });
    }
    return out;
  });

  function go(p: number) {
    if (p < 1 || p > totalPages || p === page) return;
    onPageChange?.(p);
  }

  const btn =
    'flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40';
</script>

{#if totalPages > 1}
  <div
    class="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row"
  >
    <p class="text-xs text-faint">
      Menampilkan <span class="num">{total === 0 ? 0 : (page - 1) * perPage + 1}</span>–<span
        class="num">{Math.min(page * perPage, total)}</span
      >
      dari <span class="num">{total}</span>
    </p>
    <div class="flex items-center gap-1">
      <button class="{btn} text-muted hover:bg-surface-2" disabled={page <= 1} onclick={() => go(page - 1)} aria-label="Halaman sebelumnya">
        <Icon name="chevron-left" size={16} />
      </button>
      {#each pages as p (p.k)}
        {#if p.v === '…'}
          <span class="px-1 text-xs text-faint">…</span>
        {:else}
          <button
            class="{btn} num {p.v === page ? 'bg-accent text-on-accent' : 'text-muted hover:bg-surface-2'}"
            aria-current={p.v === page ? 'page' : undefined}
            onclick={() => go(p.v as number)}
          >
            {p.v}
          </button>
        {/if}
      {/each}
      <button
        class="{btn} text-muted hover:bg-surface-2"
        disabled={page >= totalPages}
        onclick={() => go(page + 1)}
        aria-label="Halaman berikutnya"
      >
        <Icon name="chevron-right" size={16} />
      </button>
    </div>
  </div>
{/if}
