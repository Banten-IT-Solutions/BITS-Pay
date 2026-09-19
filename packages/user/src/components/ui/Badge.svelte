<script lang="ts">
  import type { PaymentStatus } from '@bits-pay/shared';
  interface Props {
    status: PaymentStatus | 'active' | 'suspended' | 'banned' | string;
    dot?: boolean;
  }
  let { status, dot = true }: Props = $props();

  const styles: Record<string, string> = {
    success: 'bg-success/10 text-success border-success/30',
    pending: 'bg-warning/10 text-warning border-warning/30',
    pending_review: 'bg-warning/10 text-warning border-warning/30',
    failed: 'bg-error/10 text-error border-error/30',
    expired: 'bg-surface-2 text-muted border-border',
    active: 'bg-success/10 text-success border-success/30',
    inactive: 'bg-surface-2 text-muted border-border',
    suspended: 'bg-warning/10 text-warning border-warning/30',
    banned: 'bg-error/10 text-error border-error/30',
    canceled: 'bg-surface-2 text-muted border-border',
    paid: 'bg-success/10 text-success border-success/30',
    free: 'bg-surface-2 text-muted border-border',
    premium: 'bg-accent-soft text-accent border-accent/30',
    premium_monthly: 'bg-accent-soft text-accent border-accent/30',
    premium_yearly: 'bg-accent-soft text-accent border-accent/30',
  };
  const labels: Record<string, string> = {
    success: 'Sukses',
    pending: 'Pending',
    pending_review: 'Review',
    failed: 'Gagal',
    expired: 'Expired',
    active: 'Aktif',
    inactive: 'Nonaktif',
    suspended: 'Suspend',
    banned: 'Banned',
    canceled: 'Dibatalkan',
    paid: 'Lunas',
    free: 'Free',
    premium: 'Premium',
    premium_monthly: 'Premium Bulanan',
    premium_yearly: 'Premium Tahunan',
  };

  let cls = $derived(styles[status] || 'bg-surface-2 text-muted border-border');
</script>

<span
  class="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap {cls}"
>
  {#if dot}
    <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>
  {/if}
  {labels[status] || status}
</span>
