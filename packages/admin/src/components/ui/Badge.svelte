<script lang="ts">
  import type { PaymentStatus } from '@bits-pay/shared';
  interface Props {
    status: PaymentStatus | 'active' | 'suspended' | 'banned' | string;
  }
  let { status }: Props = $props();

  // tone: warna dot + teks badge — konsisten di semua status
  const tones: Record<string, string> = {
    success: 'bg-success/10 text-accent-600',
    paid: 'bg-success/10 text-accent-600',
    active: 'bg-success/10 text-accent-600',
    pending: 'bg-warning/15 text-neutral-900',
    pending_review: 'bg-warning/15 text-neutral-900',
    suspended: 'bg-warning/15 text-neutral-900',
    failed: 'bg-error/10 text-error',
    dead: 'bg-error/10 text-error',
    banned: 'bg-error/10 text-error',
    expired: 'bg-neutral-200/70 text-neutral-600',
    canceled: 'bg-neutral-200/70 text-neutral-600',
    free: 'bg-neutral-200/70 text-neutral-600',
    premium: 'bg-primary-500/10 text-primary-600',
    premium_monthly: 'bg-primary-500/10 text-primary-600',
    premium_yearly: 'bg-primary-500/10 text-primary-600',
  };
  const dots: Record<string, string> = {
    success: 'bg-success',
    paid: 'bg-success',
    active: 'bg-success',
    pending: 'bg-warning',
    pending_review: 'bg-warning',
    suspended: 'bg-warning',
    failed: 'bg-error',
    dead: 'bg-error',
    banned: 'bg-error',
    expired: 'bg-neutral-400',
    canceled: 'bg-neutral-400',
    free: 'bg-neutral-400',
    premium: 'bg-primary-500',
    premium_monthly: 'bg-primary-500',
    premium_yearly: 'bg-primary-500',
  };
  const labels: Record<string, string> = {
    success: 'Sukses',
    pending: 'Pending',
    pending_review: 'Review',
    failed: 'Gagal',
    dead: 'Dead',
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

<span
  class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap {tones[status] ||
    'bg-neutral-200/70 text-neutral-600'}"
>
  <span class="h-1.5 w-1.5 flex-none rounded-full {dots[status] || 'bg-neutral-400'}" aria-hidden="true"></span>
  {labels[status] || status}
</span>
