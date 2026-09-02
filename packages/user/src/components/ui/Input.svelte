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
    value = '',
    placeholder = '',
    disabled = false,
    required = false,
    error = '',
    name = '',
    step,
    oninput,
  }: Props = $props();

  function handleInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    oninput?.(e);
    value = target.value;
  }
</script>

<div>
  {#if label}
    <label class="mb-1 block text-sm font-medium text-neutral-600">{label}</label>
  {/if}
  <input
    {type}
    {name}
    {step}
    {value}
    {placeholder}
    {disabled}
    {required}
    {oninput}
    class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-100"
    class:border-error={error}
  />
  {#if error}
    <p class="mt-1 text-xs text-error">{error}</p>
  {/if}
</div>