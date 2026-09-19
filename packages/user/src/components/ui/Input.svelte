<script lang="ts">
  interface Props {
    type?: string;
    label?: string;
    value?: string | number;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    error?: string;
    name?: string;
    step?: string;
    oninput?: (e: Event) => void;
  }
  let {
    type = 'text',
    label = '',
    value = $bindable(''),
    placeholder = '',
    disabled = false,
    required = false,
    error = '',
    name = '',
    step,
    oninput,
  }: Props = $props();

  const inputId = $props.id();
</script>

<div>
  {#if label}
    <label for={inputId} class="mb-1.5 block text-[13px] font-medium text-muted">{label}</label>
  {/if}
  <input
    id={inputId}
    {type}
    {name}
    {step}
    bind:value
    {placeholder}
    {disabled}
    {required}
    {oninput}
    class="h-10 w-full rounded-lg border bg-bg px-3 text-sm text-text transition-[border-color,box-shadow] duration-150 placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 {error
      ? 'border-error'
      : 'border-border-strong'}"
  />
  {#if error}
    <p class="mt-1.5 text-xs text-error">{error}</p>
  {/if}
</div>
