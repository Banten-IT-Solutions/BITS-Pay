<script lang="ts">
  import type { PaymentStatus } from '@bits-pay/shared';
  interface Props {
    status: PaymentStatus | 'active' | 'suspended' | 'banned' | string;
  }
  let { status }: Props = $props();

  const styles: Record<string, string> = {
    success: 'bg-success/10 text-success',
    pending: 'bg-warning/15 text-warning',
    pending_review: 'bg-warning/15 text-warning',
    failed: 'bg-error/10 text-error',
    expired: 'bg-neutral-100 text-neutral-600',
    active: 'bg-success/10 text-success',
    suspended: 'bg-warning/15 text-warning',
    banned: 'bg-error/10 text-error',
    canceled: 'bg-neutral-100 text-neutral-600',
    paid: 'bg-success/10 text-success',
    free: 'bg-neutral-100 text-neutral-600',
    premium: 'bg-primary-500/10 text-primary-500',
    premium_monthly: 'bg-primary-500/10 text-primary-500',
    premium_yearly: 'bg-primary-500/10 text-primary-500',
  };
  const labels: Record<string, string> = {
    success: 'Sukses',
    pending: 'Pending',
    pending_review: 'Review',
    failed: 'Gagal',
    expired: 'Expired',
    active: 'Aktif',
    suspended: 'Suspend',
    banned: 'Banned',
    canceled: 'Dibatalkan',
    paid: 'Lunas',
    free: 'Free',
    premium: 'Premium',
    premium_monthly: 'Premium Bulanan',
    premium_yearly: 'Premium Tahunan',
  };
</script>

<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize {styles[status] || 'bg-neutral-100 text-neutral-600'}">
  {labels[status] || status}
</span>