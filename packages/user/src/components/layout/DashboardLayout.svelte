<script lang="ts">
  import Sidebar from './Sidebar.svelte';
  import Navbar from './Navbar.svelte';
</script>

<div class="flex h-screen">
  <Sidebar />
  <div class="flex flex-1 flex-col overflow-hidden">
    <Navbar />
    <main class="flex-1 overflow-y-auto bg-neutral-50 p-6">
      <slot />
    </main>
  </div>
</div>