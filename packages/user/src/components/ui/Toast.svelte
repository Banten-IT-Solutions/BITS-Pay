<script lang="ts">
  import { toastStore, type ToastMessage } from '../../lib/toast';
  const toasts = $derived($toastStore);

  const colors: Record<ToastMessage['type'], string> = {
    success: 'bg-success text-white',
    error: 'bg-error text-white',
    warning: 'bg-warning text-white',
    info: 'bg-info text-white',
  };
</script>

{#each toasts as toast (toast.id)}
  <div class="fixed right-4 top-4 z-[100] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg {colors[toast.type]}">
    {toast.message}
  </div>
{/each}