<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  interface Props {
    open: boolean;
    title: string;
    onClose?: () => void;
    children?: Snippet;
  }
  let { open, title, onClose, children }: Props = $props();

  let panel = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (open) {
      requestAnimationFrame(() => panel?.focus());
    }
  });

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose?.();
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-[overlay-in_150ms_ease-out]"
    onclick={handleBackdrop}
    onkeydown={(e) => {
      if (e.key === 'Escape') onClose?.();
    }}
    role="dialog"
    aria-modal="true"
    aria-label={title}
    tabindex="-1"
  >
    <div
      bind:this={panel}
      class="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[10px] border border-border bg-surface p-5 shadow-overlay outline-none sm:p-6 animate-[panel-in_200ms_ease-out]"
      tabindex="-1"
    >
      <div class="mb-4 flex items-center justify-between gap-3">
        <h3 class="font-display text-lg font-semibold tracking-tight text-text">{title}</h3>
        <button
          class="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-faint transition-colors duration-150 hover:bg-surface-2 hover:text-text"
          onclick={() => onClose?.()}
          aria-label="Tutup"
        >
          <Icon name="x" size={18} />
        </button>
      </div>
      {@render children?.()}
    </div>
  </div>
{/if}
