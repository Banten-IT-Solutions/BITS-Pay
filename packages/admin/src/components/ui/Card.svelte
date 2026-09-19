<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    subtitle?: string;
    padding?: boolean;
    class?: string;
    children?: Snippet;
    actions?: Snippet;
  }
  let {
    title = '',
    subtitle = '',
    padding = true,
    class: className = '',
    children,
    actions,
  }: Props = $props();
</script>

<div class="rounded-xl border border-neutral-200 bg-white {className}" class:p-5={padding}>
  {#if title}
    <div
      class="mb-4 flex items-start justify-between gap-3 border-b border-neutral-100 pb-3 {padding ? '-mx-5 px-5' : 'px-5 pt-4'}"
    >
      <div>
        <h3 class="text-[15px] font-semibold text-neutral-900">{title}</h3>
        {#if subtitle}
          <p class="mt-0.5 text-[13px] text-neutral-600">{subtitle}</p>
        {/if}
      </div>
      {#if actions}
        <div class="flex flex-none items-center gap-2">
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}
  {@render children?.()}
</div>
