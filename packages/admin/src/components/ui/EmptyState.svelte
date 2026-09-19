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

<div class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center">
  <div class="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
    <Icon name={icon} size={22} />
  </div>
  <h3 class="text-sm font-semibold text-neutral-900">{title}</h3>
  <p class="max-w-xs text-[13px] text-neutral-600">{message}</p>
  {@render children?.()}
</div>
