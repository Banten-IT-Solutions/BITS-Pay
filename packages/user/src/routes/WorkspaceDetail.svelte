<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';
  import Modal from '../components/ui/Modal.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import type { WorkspaceWithMemberCount, AppPublic } from '@bits-pay/shared';

  let { params } = $props();
  let wsId = $derived(params?.id || '');

  let ws = $state<WorkspaceWithMemberCount | null>(null);
  let apps = $state<AppPublic[]>([]);
  let loading = $state(true);
  let error = $state('');
  let showEdit = $state(false);
  let editName = $state('');
  let editSlug = $state('');
  let submitting = $state(false);

  async function load() {
    loading = true;
    error = '';
    try {
      const [w, a] = await Promise.all([
        api.get<WorkspaceWithMemberCount>(`/app/workspaces/${wsId}`),
        api.get<AppPublic[]>(`/app/workspaces/${wsId}/apps`),
      ]);
      ws = w;
      apps = a;
      editName = w.name;
      editSlug = w.slug;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function update() {
    if (!editName || !editSlug) return;
    submitting = true;
    try {
      await api.put(`/app/workspaces/${wsId}`, { name: editName, slug: editSlug });
      showToast('Workspace diperbarui', 'success');
      showEdit = false;
      load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      submitting = false;
    }
  }

  async function remove() {
    if (!confirm('Hapus workspace ini?')) return;
    try {
      await api.delete(`/app/workspaces/${wsId}`);
      showToast('Workspace dihapus', 'success');
      push('/workspaces');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }
</script>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else if ws}
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h2 class="text-xl font-semibold">{ws.name}</h2>
      <p class="text-sm text-neutral-400">{ws.slug}</p>
    </div>
    <div class="flex gap-2">
      <Button variant="secondary" onclick={() => showEdit = true}>Edit</Button>
      <Button variant="danger" onclick={remove}>Hapus</Button>
    </div>
  </div>

  <Card title="Apps">
    {#if apps.length === 0}
      <p class="py-4 text-sm text-neutral-400">Belum ada app.</p>
    {:else}
      <div class="divide-y divide-neutral-100">
        {#each apps as app}
          <div class="flex items-center justify-between py-3">
            <div>
              <p class="font-medium text-neutral-900">{app.name}</p>
              <p class="text-xs text-neutral-400 font-mono">{app.api_key_prefix}...</p>
            </div>
            <Button variant="ghost" onclick={() => push(`/apps?workspace=${wsId}`)}>Detail</Button>
          </div>
        {/each}
      </div>
    {/if}
    <div class="mt-4">
      <Button variant="secondary" onclick={() => push(`/apps?workspace=${wsId}`)}>Kelola Apps</Button>
    </div>
  </Card>
{/if}

<Modal open={showEdit} title="Edit Workspace" onClose={() => showEdit = false}>
  <form onsubmit={(e) => { e.preventDefault(); update(); }} class="space-y-4">
    <Input label="Nama" value={editName} oninput={(e) => editName = (e.target as HTMLInputElement).value} required />
    <Input label="Slug" value={editSlug} oninput={(e) => editSlug = (e.target as HTMLInputElement).value} required />
    <Button type="submit" block loading={submitting}>Simpan</Button>
  </form>
</Modal>