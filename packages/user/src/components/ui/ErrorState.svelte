<script lang="ts">
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    message?: string;
    error?: string;
    onRetry?: () => void;
  }
  let { message = 'Terjadi kesalahan.', error, onRetry }: Props = $props();
  let displayMessage = $derived(error || message);
</script>

<div class="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center" role="alert">
  <div
    class="mb-1 flex h-12 w-12 items-center justify-center rounded-[10px] border border-error/30 bg-error/10 text-error"
  >
    <Icon name="alert" size={22} />
  </div>
  <h3 class="text-[15px] font-semibold text-text">Terjadi kesalahan</h3>
  <p class="max-w-sm text-sm text-muted">{displayMessage}</p>
  {#if onRetry}
    <div class="mt-3">
      <Button variant="secondary" onclick={onRetry}>
        <Icon name="refresh" size={15} />
        Coba lagi
      </Button>
    </div>
  {/if}
</div>
