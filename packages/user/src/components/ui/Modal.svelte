<script lang="ts">
  import type { Snippet } from 'svelte';

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
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onclick={handleBackdrop} onkeydown={(e) => { if (e.key === 'Escape') onClose?.(); }} role="dialog" aria-modal="true" tabindex="-1">
    <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-neutral-900">{title}</h3>
        <button class="text-2xl leading-none text-neutral-400 hover:text-neutral-600" onclick={() => onClose?.()} aria-label="Tutup">&times;</button>
      </div>
      {@render children?.()}
    </div>
  </div>
{/if}