<script lang="ts">
  interface Props {
    text?: string;
  }
  let { text = 'Memuat...' }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 py-14 text-neutral-600" role="status">
  <div
    class="h-7 w-7 animate-spin rounded-full border-[3px] border-neutral-200 border-t-primary-600"
    aria-hidden="true"
  ></div>
  <p class="text-[13px]">{text}</p>
</div>
