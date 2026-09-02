<script lang="ts">
  interface Props {
    headers: string[];
    loading?: boolean;
    empty?: boolean;
  }
  let { headers, loading = false, empty = false }: Props = $props();
</script>

<div class="overflow-x-auto">
  <table class="w-full text-left text-sm">
    <thead class="border-b border-neutral-100 bg-neutral-50">
      <tr>
        {#each headers as h}
          <th class="px-4 py-3 font-medium text-neutral-400">{h}</th>
        {/each}
      </tr>
    </thead>
    <tbody class="divide-y divide-neutral-100">
      {#if loading}
        <tr>
          <td colspan={headers.length} class="px-4 py-8 text-center text-neutral-400">
            <div class="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary-100 border-t-primary-500"></div>
          </td>
        </tr>
      {:else if empty}
        <tr>
          <td colspan={headers.length} class="px-4 py-8 text-center text-neutral-400">Tidak ada data</td>
        </tr>
      {:else}
        <slot />
      {/if}
    </tbody>
  </table>
</div>