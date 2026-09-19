<script lang="ts">
  import Icon from './Icon.svelte';

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

<div
  class="flex flex-col items-center justify-center gap-2 rounded-xl border border-error/20 bg-error/5 px-6 py-14 text-center"
  role="alert"
>
  <div class="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-error/10 text-error">
    <Icon name="alert" size={22} />
  </div>
  <h3 class="text-sm font-semibold text-neutral-900">Gagal Memuat Data</h3>
  <p class="max-w-sm text-[13px] text-neutral-600">{displayMessage}</p>
  {#if handleRetry}
    <button
      type="button"
      class="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-700 sm:min-h-9"
      onclick={handleRetry}
    >
      <Icon name="refresh" size={15} />
      Coba Lagi
    </button>
  {/if}
</div>
