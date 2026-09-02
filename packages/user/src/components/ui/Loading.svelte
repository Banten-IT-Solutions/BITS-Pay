<script lang="ts">
  interface Props {
    text?: string;
  }
  let { text = 'Memuat...' }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 py-12 text-neutral-400">
  <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-100 border-t-primary-500"></div>
  <p class="text-sm">{text}</p>
</div>