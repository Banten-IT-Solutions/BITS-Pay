<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    headers: string[];
    loading?: boolean;
    empty?: boolean;
    emptyText?: string;
    loadingRows?: number;
    stickyFirst?: boolean;
    children?: Snippet;
  }
  let {
    headers,
    loading = false,
    empty = false,
    emptyText = 'Tidak ada data',
    loadingRows = 5,
    stickyFirst = false,
    children,
  }: Props = $props();
</script>

<!-- Scroll horizontal di mobile; kolom pertama bisa sticky. -->
<div class="overflow-x-auto">
  <table class="w-full min-w-[640px] text-left text-sm">
    <thead>
      <tr class="border-b border-border">
        {#each headers as h, i (h)}
          <th
            class="bg-surface-2/60 px-4 py-2.5 font-mono text-[11px] font-medium tracking-[0.08em] text-faint uppercase first:pl-5 last:pr-5 {stickyFirst && i === 0
              ? 'sticky left-0 z-10'
              : ''}"
          >
            {h}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody class="divide-y divide-border">
      {#if loading}
        {#each Array.from({ length: loadingRows }) as _, r (r)}
          <tr>
            {#each headers as _, c (c)}
              <td class="px-4 py-3 first:pl-5 last:pr-5">
                <div class="skeleton h-4 w-full max-w-[120px]"></div>
              </td>
            {/each}
          </tr>
        {/each}
      {:else if empty}
        <tr>
          <td colspan={headers.length} class="px-4 py-10 text-center text-sm text-faint">
            {emptyText}
          </td>
        </tr>
      {:else}
        {@render children?.()}
      {/if}
    </tbody>
  </table>
</div>
