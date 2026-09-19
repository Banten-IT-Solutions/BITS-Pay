<script lang="ts" module>
  export interface TableHeader {
    label: string;
    align?: 'left' | 'right';
    /** class tambahan per kolom, mis. 'hidden md:table-cell' untuk kolom prioritas rendah */
    class?: string;
  }

  /** Class <td> yang sejajar dengan header — dipakai route untuk sel body. */
  export function bodyCell(h: TableHeader, i: number, stickyFirst: boolean): string {
    const align = h.align === 'right' ? 'text-right' : 'text-left';
    const sticky = stickyFirst && i === 0 ? 'sticky left-0 z-10 bg-white' : '';
    return `px-4 py-3 first:pl-5 last:pr-5 ${align} ${sticky} ${h.class ?? ''}`;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    headers: TableHeader[];
    loading?: boolean;
    loadingRows?: number;
    /** kolom pertama sticky saat scroll horizontal di layar kecil */
    stickyFirst?: boolean;
    children?: Snippet;
  }
  let { headers, loading = false, loadingRows = 6, stickyFirst = false, children }: Props = $props();

  function cellClass(h: TableHeader, i: number, head: boolean): string {
    const base = head ? 'px-4 py-2.5 first:pl-5 last:pr-5' : 'px-4 py-3 first:pl-5 last:pr-5';
    const align = h.align === 'right' ? 'text-right' : 'text-left';
    const sticky =
      stickyFirst && i === 0 ? `sticky left-0 z-10 ${head ? 'bg-neutral-50' : 'bg-white'}` : '';
    return `${base} ${align} ${sticky} ${h.class ?? ''}`;
  }
</script>

<!-- Pola tabel admin: scroll horizontal terkontrol, kolom pertama opsional sticky. -->
<div class="scroll-x">
  <table class="w-full min-w-[680px] text-[13px]">
    <thead>
      <tr class="border-b border-neutral-200">
        {#each headers as h, i (h.label)}
          <th
            scope="col"
            class="{cellClass(h, i, true)} font-mono text-[10.5px] font-medium tracking-[0.1em] text-neutral-600 uppercase {stickyFirst && i === 0 ? '' : 'bg-neutral-50'}"
          >
            {h.label}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody class="divide-y divide-neutral-100">
      {#if loading}
        {#each Array.from({ length: loadingRows }) as _, r (r)}
          <tr>
            {#each headers as h, c (h.label)}
              <td class={cellClass(h, c, false)}>
                <div class="skeleton h-3.5 {h.align === 'right' ? 'ml-auto' : ''} w-full max-w-[110px]"></div>
              </td>
            {/each}
          </tr>
        {/each}
      {:else}
        {@render children?.()}
      {/if}
    </tbody>
  </table>
</div>
