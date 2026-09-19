<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';
  import Modal from '../components/ui/Modal.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import Icon from '../components/ui/Icon.svelte';
  import type { WorkspaceWithMemberCount, AppPublic, AppWithSecrets } from '@bits-pay/shared';

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
    } catch (e) {
      error = (e as Error).message;
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
      const app = await api.post<AppWithSecrets>(`/app/workspaces/${selectedWid}/apps`, {
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
      if (app.callback_secret) {
        showToast(`Callback Secret: ${app.callback_secret} — simpan untuk verifikasi webhook!`, 'info');
      }
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      submitting = false;
    }
  }

  async function rotateKey(appId: string) {
    if (!confirm('Rotate API key? Key lama tidak bisa dipakai lagi.')) return;
    try {
      const app = await api.post<AppWithSecrets>(
        `/app/workspaces/${selectedWid}/apps/${appId}/rotate-key`,
      );
      showToast(`API Key baru: ${app.api_key} — simpan!`, 'success');
      if (app.callback_secret) {
        showToast(`Callback Secret: ${app.callback_secret} — simpan untuk verifikasi webhook!`, 'info');
      }
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }
</script>

<div class="mb-5 flex items-center justify-end">
  <Button onclick={() => (showCreate = true)} disabled={workspaces.length === 0}>
    <Icon name="plus" size={16} />
    Buat App
  </Button>
</div>

{#if loading}
  <div class="skeleton mb-4 h-10 w-64 rounded-lg"></div>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {#each [1, 2] as n (n)}
      <div class="skeleton h-[120px] rounded-[10px]"></div>
    {/each}
  </div>
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else if workspaces.length === 0}
  <EmptyState
    title="Belum Ada Workspace"
    message="Buat workspace dulu sebelum membuat app."
    icon="workspaces"
  />
{:else}
  <!-- Segmented workspace picker -->
  <div
    class="mb-5 flex w-full flex-wrap items-center gap-1 rounded-[10px] border border-border bg-surface-2 p-1 sm:w-auto sm:inline-flex"
    role="tablist"
    aria-label="Pilih workspace"
  >
    {#each workspaces as ws (ws.id)}
      <button
        role="tab"
        aria-selected={selectedWid === ws.id}
        class="h-8 rounded-lg px-3 text-[13px] font-medium transition-colors duration-150 {selectedWid ===
        ws.id
          ? 'bg-surface text-text shadow-card'
          : 'text-muted hover:text-text'}"
        onclick={() => loadApps(ws.id)}
      >
        {ws.name}
      </button>
    {/each}
  </div>

  {#if apps.length === 0}
    <EmptyState
      title="Belum Ada App"
      message="Buat app untuk workspace ini dan dapatkan API key."
      icon="apps"
    >
      <Button onclick={() => (showCreate = true)}>
        <Icon name="plus" size={16} />
        Buat App
      </Button>
    </EmptyState>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {#each apps as app (app.id)}
        <Card>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="truncate font-semibold text-text">{app.name}</h3>
                <Badge status={app.is_active ? 'active' : 'inactive'} />
              </div>
              <div class="mt-2 flex items-center gap-1.5">
                <code class="num rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
                  {app.api_key_prefix}…
                </code>
              </div>
              {#if app.callback_url}
                <p class="mt-2 truncate text-xs text-faint" title={app.callback_url}>
                  Callback: {app.callback_url}
                </p>
              {:else}
                <p class="mt-2 text-xs text-faint">Callback belum diatur</p>
              {/if}
            </div>
            <Button variant="ghost" size="sm" class="flex-none" onclick={() => rotateKey(app.id)}>
              <Icon name="refresh" size={14} />
              Rotate Key
            </Button>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
{/if}

<Modal open={showCreate} title="Buat App" onClose={() => (showCreate = false)}>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      create();
    }}
    class="space-y-4"
  >
    <Input
      label="Nama App"
      value={newName}
      oninput={(e) => (newName = (e.target as HTMLInputElement).value)}
      required
    />
    <Input
      label="Callback URL (opsional)"
      type="url"
      value={newCallback}
      oninput={(e) => (newCallback = (e.target as HTMLInputElement).value)}
      placeholder="https://example.com/callback"
    />
    <Button type="submit" block loading={submitting}>Buat App</Button>
  </form>
</Modal>
