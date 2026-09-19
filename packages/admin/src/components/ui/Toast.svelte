<script lang="ts">
  import { toastStore, type ToastMessage } from '../../lib/toast';
  import Icon, { type IconName } from './Icon.svelte';

  const toasts = $derived($toastStore);

  const styles: Record<ToastMessage['type'], string> = {
    success: 'border-accent-500/30 bg-white text-neutral-900',
    error: 'border-error/30 bg-white text-neutral-900',
    warning: 'border-warning/40 bg-white text-neutral-900',
    info: 'border-primary-400/40 bg-white text-neutral-900',
  };
  const iconStyles: Record<ToastMessage['type'], string> = {
    success: 'text-accent-600',
    error: 'text-error',
    warning: 'text-warning',
    info: 'text-info',
  };
  const icons: Record<ToastMessage['type'], IconName> = {
    success: 'check',
    error: 'alert',
    warning: 'alert',
    info: 'clock',
  };
</script>

<div class="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-80" role="status" aria-live="polite">
  {#each toasts as toast (toast.id)}
    <div class="animate-toast-in pointer-events-auto flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm font-medium shadow-lg {styles[toast.type]}">
      <span class={iconStyles[toast.type]}>
        <Icon name={icons[toast.type]} size={16} />
      </span>
      <span class="min-w-0 flex-1">{toast.message}</span>
    </div>
  {/each}
</div>
