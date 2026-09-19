<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from './Icon.svelte';

  interface Props {
    title?: string;
    message?: string;
    icon?: IconName;
    children?: Snippet;
  }
  let {
    title = 'Tidak ada data',
    message = 'Belum ada item untuk ditampilkan.',
    icon = 'inbox',
    children,
  }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
  <div
    class="mb-1 flex h-12 w-12 items-center justify-center rounded-[10px] border border-border bg-surface-2 text-faint"
  >
    <Icon name={icon} size={22} />
  </div>
  <h3 class="text-[15px] font-semibold text-text">{title}</h3>
  <p class="max-w-xs text-sm text-muted">{message}</p>
  {#if children}
    <div class="mt-3">
      {@render children()}
    </div>
  {/if}
</div>
