<script lang="ts">
  interface Props {
    message?: string;
    error?: string;
    onRetry?: () => void;
    retry?: () => void;
  }
  let { message, error, onRetry, retry }: Props = $props();
  const handleRetry = $derived(onRetry || retry);
  let displayMessage = $derived(error || message || 'Gagal memproses data.');
</script>

<div class="flex flex-col items-center justify-center gap-3 py-16 text-center" role="alert">
  <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-error/10 text-2xl text-error ring-8 ring-error/5">
    &#9888;&#65039;
  </div>
  <h3 class="text-base font-semibold text-neutral-900">Gagal Memuat Data</h3>
  <p class="max-w-sm text-sm text-neutral-500">{displayMessage}</p>
  {#if handleRetry}
    <button
      type="button"
      class="mt-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 cursor-pointer"
      onclick={handleRetry}
    >
      Coba Lagi
    </button>
  {/if}
</div>