<script lang="ts">
  interface Props {
    title?: string;
    subtitle?: string;
    padding?: boolean;
    class?: string;
  }
  let { title = '', subtitle = '', padding = true, class: className = '' }: Props = $props();
</script>

<div class="rounded-xl border border-neutral-100 bg-white shadow-sm {className}" class:p-6={padding}>
  {#if title}
    <div class="mb-4">
      <h3 class="text-lg font-semibold text-neutral-900">{title}</h3>
      {#if subtitle}
        <p class="text-sm text-neutral-600">{subtitle}</p>
      {/if}
    </div>
  {/if}
  <slot />
</div>