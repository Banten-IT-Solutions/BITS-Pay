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

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose?.();
  }
</script>

{#if open}
  <!-- Mobile: sheet dari bawah; ≥sm: dialog tengah -->
  <div
    class="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-ink-950/60 p-0 sm:items-center sm:p-4"
    onclick={handleBackdrop}
    onkeydown={(e) => {
      if (e.key === 'Escape') onClose?.();
    }}
    role="dialog"
    aria-modal="true"
    aria-label={title}
    tabindex="-1"
  >
    <div class="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl sm:p-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h3 class="text-[15px] font-semibold text-neutral-900">{title}</h3>
        <button
          type="button"
          class="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 sm:min-h-8 sm:min-w-8"
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
