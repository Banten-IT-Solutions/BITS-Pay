<script lang="ts">
  interface Props {
    open: boolean;
    title: string;
    onClose?: () => void;
  }
  let { open, title, onClose }: Props = $props();

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose?.();
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onclick={handleBackdrop} role="dialog" aria-modal="true">
    <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-neutral-900">{title}</h3>
        <button class="text-2xl leading-none text-neutral-400 hover:text-neutral-600" onclick={() => onClose?.()} aria-label="Tutup">&times;</button>
      </div>
      <slot />
    </div>
  </div>
{/if}