<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { workspaces } from '../stores/workspace';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';
  import Modal from '../components/ui/Modal.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';

  let loading = $state(true);
  let error = $state('');
  let showCreate = $state(false);
  let newName = $state('');
  let newSlug = $state('');
  let submitting = $state(false);

  async function load() {
    loading = true;
    error = '';
    try {
      await workspaces.fetch();
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function create() {
    if (!newName || !newSlug) return;
    submitting = true;
    try {
      const ws = await workspaces.create({ name: newName, slug: newSlug });
      showToast('Workspace berhasil dibuat', 'success');
      showCreate = false;
      newName = '';
      newSlug = '';
      push(`/workspaces/${ws.id}`);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      submitting = false;
    }
  }
</script>

<div class="mb-6 flex items-center justify-between">
  <h2 class="text-xl font-semibold">Workspaces</h2>
  <Button onclick={() => showCreate = true}>Buat Workspace</Button>
</div>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else if $workspaces.length === 0}
  <EmptyState title="Belum ada workspace" message="Buat workspace pertama untuk mulai.">
    <Button onclick={() => showCreate = true}>Buat Workspace</Button>
  </EmptyState>
{:else}
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each $workspaces as ws}
      <Card>
        <div class="cursor-pointer" onclick={() => push(`/workspaces/${ws.id}`)}>
          <h3 class="text-lg font-semibold text-primary-500">{ws.name}</h3>
          <p class="mt-1 text-sm text-neutral-400">{ws.slug}</p>
          <div class="mt-3 flex gap-4 text-xs text-neutral-400">
            <span>{ws.app_count ?? 0} App</span>
            <span>{ws.member_count ?? 0} Anggota</span>
          </div>
        </div>
      </Card>
    {/each}
  </div>
{/if}

<Modal open={showCreate} title="Buat Workspace" onClose={() => showCreate = false}>
  <form onsubmit={(e) => { e.preventDefault(); create(); }} class="space-y-4">
    <Input label="Nama" value={newName} oninput={(e) => newName = (e.target as HTMLInputElement).value} required />
    <Input label="Slug" value={newSlug} oninput={(e) => newSlug = (e.target as HTMLInputElement).value} required placeholder="my-workspace" />
    <Button type="submit" block loading={submitting}>Buat</Button>
  </form>
</Modal>