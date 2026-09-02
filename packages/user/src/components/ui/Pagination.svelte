<script lang="ts">
  interface Props {
    page: number;
    perPage: number;
    total: number;
    onPageChange?: (page: number) => void;
  }
  let { page, perPage, total, onPageChange }: Props = $props();

  const totalPages = $derived(Math.max(1, Math.ceil(total / perPage)));

  function go(p: number) {
    if (p < 1 || p > totalPages || p === page) return;
    onPageChange?.(p);
  }
</script>

{#if totalPages > 1}
  <div class="flex items-center justify-between border-t border-neutral-100 px-4 py-3">
    <p class="text-sm text-neutral-400">
      Menampilkan {total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, total)} dari {total}
    </p>
    <div class="flex items-center gap-1">
      <button class="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-40" disabled={page <= 1} onclick={() => go(page - 1)}>&larr;</button>
      {#each Array.from({ length: totalPages }, (_, i) => i + 1) as p}
        <button class="rounded-md px-3 py-1.5 text-sm {p === page ? 'bg-primary-500 text-white' : 'text-neutral-600 hover:bg-neutral-100'}" onclick={() => go(p)}>{p}</button>
      {/each}
      <button class="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-40" disabled={page >= totalPages} onclick={() => go(page + 1)}>&rarr;</button>
    </div>
  </div>
{/if}