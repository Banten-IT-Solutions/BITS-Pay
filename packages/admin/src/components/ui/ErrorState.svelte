<script lang="ts">
  interface Props {
    message?: string;
    error?: string;
    onRetry?: () => void;
  }
  let { message = 'Terjadi kesalahan.', error, onRetry }: Props = $props();
  let displayMessage = $derived(error || message);
</script>

<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
  <div class="flex h-16 w-16 items-center justify-center rounded-full bg-error/10 text-3xl">&#9888;&#65039;</div>
  <h3 class="text-base font-semibold text-neutral-900">Terjadi kesalahan</h3>
  <p class="text-sm text-neutral-400">{displayMessage}</p>
  {#if onRetry}
    <button class="mt-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600" onclick={onRetry}>
      Coba lagi
    </button>
  {/if}
</div>