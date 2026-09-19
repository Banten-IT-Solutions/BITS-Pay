<script lang="ts">
  interface Props {
    size?: number;
  }
  let { size = 22 }: Props = $props();
</script>

<!-- Logo QR finder mark — sama dengan landing. -->
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" class="flex-none">
  <rect x="2" y="2" width="20" height="20" rx="5.5" stroke="#e0272f" stroke-width="3.5" />
  <rect x="8" y="8" width="8" height="8" rx="2" fill="#e0272f" />
</svg>
