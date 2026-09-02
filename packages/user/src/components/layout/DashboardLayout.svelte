<script lang="ts">
  import type { Snippet } from 'svelte';
  import Sidebar from './Sidebar.svelte';
  import Navbar from './Navbar.svelte';

  let { children }: { children?: Snippet } = $props();
</script>

<div class="flex h-screen">
  <Sidebar />
  <div class="flex flex-1 flex-col overflow-hidden">
    <Navbar />
    <main class="flex-1 overflow-y-auto bg-neutral-50 p-6">
      {@render children?.()}
    </main>
  </div>
</div>