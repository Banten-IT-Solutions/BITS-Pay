<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    subtitle?: string;
    padding?: boolean;
    class?: string;
    actions?: Snippet;
    children?: Snippet;
  }
  let {
    title = '',
    subtitle = '',
    padding = true,
    class: className = '',
    actions,
    children,
  }: Props = $props();
</script>

<div class="rounded-[10px] border border-border bg-surface {className}">
  {#if title || actions}
    <div class="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5 {padding ? 'pb-0 mb-4' : 'pb-4'}">
      <div class="min-w-0">
        {#if title}
          <h3 class="font-display text-[15px] font-semibold tracking-tight text-text">{title}</h3>
        {/if}
        {#if subtitle}
          <p class="mt-0.5 text-sm text-muted">{subtitle}</p>
        {/if}
      </div>
      {#if actions}
        <div class="flex flex-none items-center gap-2">
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}
  {#if padding}
    <div class={title || actions ? 'px-4 pb-4 sm:px-5 sm:pb-5' : 'p-4 sm:p-5'}>
      {@render children?.()}
    </div>
  {:else}
    {@render children?.()}
  {/if}
</div>
