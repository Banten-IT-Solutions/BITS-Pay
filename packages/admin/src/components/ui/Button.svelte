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

  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-900',
    secondary: 'bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-100 active:bg-neutral-200',
    ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
    danger: 'bg-error text-white hover:brightness-95 active:brightness-90',
  };
  // min-h-11 (44px) di mobile = target sentuh aman; lebih rapat mulai sm
  const sizes: Record<string, string> = {
    sm: 'min-h-11 px-3 text-[13px] sm:min-h-8',
    md: 'min-h-11 px-4 text-sm sm:min-h-9',
    lg: 'min-h-11 px-5 text-[15px]',
  };
</script>

<button
  {type}
  disabled={disabled || loading}
  class="{base} {variants[variant]} {sizes[size]} {block ? 'w-full' : ''}"
  {onclick}
>
  {#if loading}
    <span
      class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80"
      aria-hidden="true"
    ></span>
    <span class="sr-only">Memproses...</span>
  {/if}
  {@render children?.()}
</button>
