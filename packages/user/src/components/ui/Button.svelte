<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
    block?: boolean;
    size?: 'sm' | 'md' | 'lg';
    class?: string;
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
    class: className = '',
    onclick,
    children,
  }: Props = $props();

  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-[background,color,border-color,box-shadow,transform] duration-150 select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50';
  const variants: Record<string, string> = {
    primary: 'bg-accent text-on-accent hover:bg-accent-strong',
    secondary: 'bg-surface text-text border border-border-strong hover:bg-surface-2 hover:border-faint',
    ghost: 'bg-transparent text-muted hover:bg-surface-2 hover:text-text',
    danger: 'bg-error text-white hover:opacity-90',
  };
  const sizes: Record<string, string> = {
    sm: 'h-9 px-3 text-[13px]',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-6 text-[15px]',
  };
</script>

<button
  {type}
  disabled={disabled || loading}
  class="{base} {variants[variant]} {sizes[size]} {block ? 'w-full' : ''} {className}"
  {onclick}
>
  {#if loading}
    <span
      class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80"
      aria-hidden="true"
    ></span>
  {/if}
  {@render children?.()}
</button>
