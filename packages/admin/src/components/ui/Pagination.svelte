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

  // Jendela nomor halaman: maks 5 di sekitar halaman aktif
  const windowPages = $derived.by(() => {
    const span = 5;
    let start = Math.max(1, page - Math.floor(span / 2));
    const end = Math.min(totalPages, start + span - 1);
    start = Math.max(1, end - span + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });

  function go(p: number) {
    if (p < 1 || p > totalPages || p === page) return;
    onPageChange?.(p);
  }
</script>

{#if totalPages > 1}
  <div class="flex flex-col gap-2 border-t border-neutral-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <p class="num text-xs text-neutral-600">
      {total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, total)} dari {total}
    </p>
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-40 sm:min-h-8 sm:min-w-8"
        disabled={page <= 1}
        onclick={() => go(page - 1)}
        aria-label="Halaman sebelumnya"
      >
        <Icon name="chevron-left" size={16} />
      </button>
      {#each windowPages as p (p)}
        <button
          type="button"
          class="num min-h-11 min-w-11 rounded-lg text-[13px] font-medium transition-colors sm:min-h-8 sm:min-w-8 {p === page
            ? 'bg-primary-600 text-white'
            : 'text-neutral-600 hover:bg-neutral-100'}"
          aria-current={p === page ? 'page' : undefined}
          onclick={() => go(p)}
        >
          {p}
        </button>
      {/each}
      <button
        type="button"
        class="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-40 sm:min-h-8 sm:min-w-8"
        disabled={page >= totalPages}
        onclick={() => go(page + 1)}
        aria-label="Halaman berikutnya"
      >
        <Icon name="chevron-right" size={16} />
      </button>
    </div>
  </div>
{/if}
