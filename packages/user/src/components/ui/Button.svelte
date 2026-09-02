<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
    block?: boolean;
    size?: 'sm' | 'md' | 'lg';
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
  }
  let {
    variant = 'primary',
    type = 'button',
    disabled = false,
    loading = false,
    block = false,
    size = 'md',
    onclick,
    children,
  }: Props = $props();

  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600',
    secondary: 'bg-neutral-100 text-neutral-900 border border-neutral-200 hover:bg-neutral-200',
    ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100',
    danger: 'bg-error text-white hover:opacity-90',
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
</script>

<button {type} {disabled} class="{base} {variants[variant]} {sizes[size]} {block ? 'w-full' : ''}" {onclick}>
  {#if loading}
    <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
  {/if}
  {@render children?.()}
</button>