<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';
  import Modal from '../components/ui/Modal.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import Icon from '../components/ui/Icon.svelte';
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
    } catch (e) {
      error = (e as Error).message;
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
    } catch (e) {
      showToast((e as Error).message, 'error');
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
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }
</script>

{#if loading}
  <div class="space-y-4">
    <div class="skeleton h-8 w-48"></div>
    <div class="skeleton h-56 rounded-[10px]"></div>
  </div>
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else if ws}
  <div class="mb-5">
    <button
      class="mb-3 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
      onclick={() => push('/workspaces')}
    >
      <Icon name="arrow-left" size={16} />
      Workspaces
    </button>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="font-display text-xl font-semibold tracking-tight text-text">{ws.name}</h2>
        <p class="num mt-0.5 text-xs text-faint">{ws.slug}</p>
      </div>
      <div class="flex flex-none gap-2">
        <Button variant="secondary" size="sm" onclick={() => (showEdit = true)}>Edit</Button>
        <Button variant="danger" size="sm" onclick={remove}>Hapus</Button>
      </div>
    </div>
  </div>

  <Card title="Apps" padding={false} class="overflow-hidden">
    {#snippet actions()}
      <Button variant="secondary" size="sm" onclick={() => push(`/apps?workspace=${wsId}`)}>
        Kelola Apps
      </Button>
    {/snippet}
    {#if apps.length === 0}
      <EmptyState
        title="Belum Ada App"
        message="Buat app untuk mendapatkan API key dan mulai terima pembayaran."
        icon="apps"
      >
        <Button onclick={() => push(`/apps?workspace=${wsId}`)}>
          <Icon name="plus" size={16} />
          Buat App
        </Button>
      </EmptyState>
    {:else}
      <ul class="divide-y divide-border">
        {#each apps as app (app.id)}
          <li>
            <button
              class="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-surface-2/50 sm:px-5"
              onclick={() => push(`/apps?workspace=${wsId}`)}
            >
              <div class="min-w-0">
                <p class="truncate font-medium text-text">{app.name}</p>
                <p class="num mt-0.5 text-xs text-faint">{app.api_key_prefix}…</p>
              </div>
              <Icon name="chevron-right" size={16} class="flex-none text-faint" />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </Card>
{/if}

<Modal open={showEdit} title="Edit Workspace" onClose={() => (showEdit = false)}>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      update();
    }}
    class="space-y-4"
  >
    <Input
      label="Nama"
      value={editName}
      oninput={(e) => (editName = (e.target as HTMLInputElement).value)}
      required
    />
    <Input
      label="Slug"
      value={editSlug}
      oninput={(e) => (editSlug = (e.target as HTMLInputElement).value)}
      required
    />
    <Button type="submit" block loading={submitting}>Simpan</Button>
  </form>
</Modal>
