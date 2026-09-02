<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    message?: string;
    children?: Snippet;
  }
  let { title = 'Tidak ada data', message = 'Belum ada item untuk ditampilkan.', children }: Props =
    $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
  <div class="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-3xl">&#128230;</div>
  <h3 class="text-base font-semibold text-neutral-900">{title}</h3>
  <p class="text-sm text-neutral-400">{message}</p>
  {@render children?.()}
</div>