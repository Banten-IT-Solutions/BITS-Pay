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
  import EmptyState from '../components/ui/EmptyState.svelte';
  import type { WorkspaceWithMemberCount, AppPublic } from '@bits-pay/shared';

  let workspaces = $state<WorkspaceWithMemberCount[]>([]);
  let selectedWid = $state('');
  let apps = $state<AppPublic[]>([]);
  let loading = $state(true);
  let error = $state('');
  let showCreate = $state(false);
  let newName = $state('');
  let newCallback = $state('');
  let submitting = $state(false);

  async function load() {
    loading = true;
    error = '';
    try {
      const w = await api.get<WorkspaceWithMemberCount[]>('/app/workspaces');
      workspaces = w;
      if (w.length > 0) {
        selectedWid = w[0].id;
        await loadApps(w[0].id);
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function loadApps(wid: string) {
    selectedWid = wid;
    apps = await api.get<AppPublic[]>(`/app/workspaces/${wid}/apps`);
  }

  onMount(load);

  async function create() {
    if (!newName || !selectedWid) return;
    submitting = true;
    try {
      const app = await api.post<AppPublic>(`/app/workspaces/${selectedWid}/apps`, {
        name: newName,
        callback_url: newCallback || undefined,
      });
      showToast('App berhasil dibuat', 'success');
      showCreate = false;
      newName = '';
      newCallback = '';
      apps = [...apps, app];
      if (app.api_key) {
        showToast(`API Key: ${app.api_key} — simpan!`, 'info');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      submitting = false;
    }
  }

  async function rotateKey(appId: string) {
    if (!confirm('Rotate API key? Key lama tidak bisa dipakai lagi.')) return;
    try {
      const app = await api.post<AppPublic>(`/app/workspaces/${selectedWid}/apps/${appId}/rotate-key`);
      showToast(`API Key baru: ${app.api_key} — simpan!`, 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }
</script>

<div class="mb-6 flex items-center justify-between">
  <h2 class="text-xl font-semibold">Apps</h2>
  <Button onclick={() => showCreate = true}>Buat App</Button>
</div>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else if workspaces.length === 0}
  <EmptyState title="Belum ada workspace" message="Buat workspace dulu sebelum membuat app." />
{:else}
  <div class="mb-4 flex gap-2">
    {#each workspaces as ws}
      <button
        class="rounded-lg px-4 py-2 text-sm font-medium transition-colors {selectedWid === ws.id ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}"
        onclick={() => loadApps(ws.id)}
      >
        {ws.name}
      </button>
    {/each}
  </div>

  {#if apps.length === 0}
    <EmptyState title="Belum ada app" message="Buat app untuk workspace ini.">
      <Button onclick={() => showCreate = true}>Buat App</Button>
    </EmptyState>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {#each apps as app}
        <Card>
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-semibold text-neutral-900">{app.name}</h3>
              <p class="mt-1 text-xs font-mono text-neutral-400">{app.api_key_prefix}...</p>
              {#if app.callback_url}
                <p class="mt-1 text-xs text-neutral-400">Callback: {app.callback_url}</p>
              {/if}
            </div>
            <Button variant="ghost" size="sm" onclick={() => rotateKey(app.id)}>Rotate Key</Button>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
{/if}

<Modal open={showCreate} title="Buat App" onClose={() => showCreate = false}>
  <form onsubmit={(e) => { e.preventDefault(); create(); }} class="space-y-4">
    <Input label="Nama App" value={newName} oninput={(e) => newName = (e.target as HTMLInputElement).value} required />
    <Input label="Callback URL (opsional)" type="url" value={newCallback} oninput={(e) => newCallback = (e.target as HTMLInputElement).value} placeholder="https://example.com/callback" />
    <Button type="submit" block loading={submitting}>Buat</Button>
  </form>
</Modal>