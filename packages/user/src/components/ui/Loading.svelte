<script lang="ts">
  interface Props {
    text?: string;
  }
  let { text = 'Memuat...' }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 py-12 text-faint" role="status">
  <div
    class="h-7 w-7 animate-spin rounded-full border-[3px] border-border border-t-accent"
    aria-hidden="true"
  ></div>
  <p class="text-sm">{text}</p>
</div>
