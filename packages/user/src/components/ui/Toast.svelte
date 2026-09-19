<script lang="ts">
  import { toastStore, type ToastType } from '../../lib/toast';
  import Icon, { type IconName } from './Icon.svelte';

  const toasts = $derived($toastStore);

  const styles: Record<ToastType, { border: string; icon: IconName; iconClass: string }> = {
    success: { border: 'border-l-success', icon: 'check', iconClass: 'text-success' },
    error: { border: 'border-l-error', icon: 'alert', iconClass: 'text-error' },
    warning: { border: 'border-l-warning', icon: 'alert', iconClass: 'text-warning' },
    info: { border: 'border-l-info', icon: 'clock', iconClass: 'text-info' },
  };

</script>

<div
  class="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:w-[360px]"
  aria-live="polite"
>
  {#each toasts as toast (toast.id)}
    {@const s = styles[toast.type]}
    <div
      class="pointer-events-auto flex w-full items-start gap-2.5 rounded-lg border border-border border-l-[3px] bg-surface px-3.5 py-3 text-sm text-text shadow-overlay animate-[toast-in_200ms_ease-out] {s.border}"
      role="status"
    >
      <span class="mt-0.5 flex-none {s.iconClass}">
        <Icon name={s.icon} size={15} />
      </span>
      <p class="min-w-0 flex-1 break-words">{toast.message}</p>
    </div>
  {/each}
</div>
