<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast';
  import { copyText } from '../lib/clipboard';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';
  import Modal from '../components/ui/Modal.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import Icon from '../components/ui/Icon.svelte';
  import QrisInput from '../components/QrisInput.svelte';
  import type { WorkspaceWithMemberCount, AppPublic, AppWithSecrets } from '@bits-pay/shared';

  let workspaces = $state<WorkspaceWithMemberCount[]>([]);
  let selectedWid = $state('');
  let apps = $state<AppPublic[]>([]);
  let loading = $state(true);
  let error = $state('');
  let showCreate = $state(false);
  let newName = $state('');
  let newCallback = $state('');
  let newQris = $state('');
  let submitting = $state(false);
  let editingApp = $state<AppPublic | null>(null);
  let editCallback = $state('');
  let editQris = $state('');
  // Kredensial sekali-tampil setelah buat app / rotate key.
  let secret = $state<{ appName: string; apiKey: string; callbackSecret: string } | null>(null);

  async function salin(text: string, label: string) {
    const ok = await copyText(text);
    showToast(
      ok ? `${label} disalin` : 'Gagal menyalin — salin manual',
      ok ? 'success' : 'error',
    );
  }

  function openEdit(app: AppPublic) {
    editingApp = app;
    editCallback = app.callback_url ?? '';
    editQris = app.qris_static ?? '';
  }

  async function saveSettings() {
    if (!editingApp) return;
    // QRIS wajib — server menolak kosong/null; cegah lebih awal di client.
    if (!editQris.trim()) {
      showToast('QRIS static wajib diisi', 'error');
      return;
    }
    submitting = true;
    try {
      const updated = await api.put<AppPublic>(
        `/app/workspaces/${selectedWid}/apps/${editingApp.id}`,
        {
          callback_url: editCallback.trim(),
          qris_static: editQris.trim(),
        },
      );
      apps = apps.map((a) =>
        a.id === updated.id
          ? { ...a, callback_url: updated.callback_url, qris_static: updated.qris_static }
          : a,
      );
      showToast('Pengaturan app disimpan', 'success');
      editingApp = null;
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      submitting = false;
    }
  }

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
    if (!newName || !selectedWid || !newQris.trim()) return;
    submitting = true;
    try {
      const app = await api.post<AppWithSecrets>(`/app/workspaces/${selectedWid}/apps`, {
        name: newName,
        callback_url: newCallback || undefined,
        qris_static: newQris.trim(),
      });
      showCreate = false;
      newName = '';
      newCallback = '';
      newQris = '';
      apps = [...apps, app];
      // Tampilkan kredensial sekali saja di modal (bukan toast yang mudah hilang).
      secret = {
        appName: app.name,
        apiKey: app.api_key,
        callbackSecret: app.callback_secret,
      };
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      submitting = false;
    }
  }

  async function rotateKey(app: AppPublic) {
    if (!confirm(`Rotate API key "${app.name}"? Key lama tidak bisa dipakai lagi.`)) return;
    try {
      const updated = await api.post<AppWithSecrets>(
        `/app/workspaces/${selectedWid}/apps/${app.id}/rotate-key`,
      );
      apps = apps.map((a) =>
        a.id === updated.id ? { ...a, api_key_prefix: updated.api_key_prefix } : a,
      );
      // Tampilkan key baru sekali saja di modal (bukan toast yang mudah hilang).
      secret = {
        appName: updated.name,
        apiKey: updated.api_key,
        callbackSecret: updated.callback_secret,
      };
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
              {#if app.qris_static}
                <p class="mt-1 text-xs text-success">QRIS terpasang</p>
              {:else}
                <p class="mt-1 text-xs text-warning">QRIS belum diatur</p>
              {/if}
            </div>
            <div class="flex flex-none flex-col gap-1">
              <Button variant="ghost" size="sm" onclick={() => rotateKey(app)}>
                <Icon name="refresh" size={14} />
                Rotate Key
              </Button>
              <Button variant="ghost" size="sm" onclick={() => openEdit(app)}>
                <Icon name="qr" size={14} />
                Pengaturan
              </Button>
            </div>
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
    <QrisInput bind:value={newQris} />
    <Button type="submit" block loading={submitting} disabled={!newName || !newQris.trim()}>
      Buat App
    </Button>
  </form>
</Modal>

<Modal open={editingApp !== null} title="Pengaturan App" onClose={() => (editingApp = null)}>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      saveSettings();
    }}
    class="space-y-4"
  >
    <div>
      <Input
        label="Webhook Callback URL"
        type="url"
        value={editCallback}
        oninput={(e) => (editCallback = (e.target as HTMLInputElement).value)}
        placeholder="https://example.com/callback"
      />
      <p class="mt-1.5 text-xs text-faint">
        URL HTTPS publik yang menerima notifikasi pembayaran. Kosongkan untuk menonaktifkan
        webhook.
      </p>
    </div>
    <QrisInput bind:value={editQris} />
    <Button type="submit" block loading={submitting} disabled={!editQris.trim()}>
      Simpan Pengaturan
    </Button>
  </form>
</Modal>

<Modal open={secret !== null} title="Simpan Kredensial App" onClose={() => (secret = null)}>
  <div class="space-y-4">
    <div class="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed text-warning" role="alert">
      <strong>Simpan sekarang.</strong> API key hanya ditampilkan sekali ini dan tidak bisa dilihat
      lagi setelah modal ditutup.
    </div>
    <div>
      <p class="mb-1.5 text-[13px] font-medium text-muted">API Key — {secret?.appName}</p>
      <div class="flex items-start gap-2">
        <code class="num min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs break-all text-text">
          {secret?.apiKey}
        </code>
        <Button
          variant="secondary"
          size="sm"
          onclick={() => secret && salin(secret.apiKey, 'API Key')}
        >
          <Icon name="copy" size={14} />
          Salin
        </Button>
      </div>
    </div>
    {#if secret?.callbackSecret}
      <div>
        <p class="mb-1.5 text-[13px] font-medium text-muted">Callback Secret</p>
        <div class="flex items-start gap-2">
          <code class="num min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs break-all text-text">
            {secret.callbackSecret}
          </code>
          <Button
            variant="secondary"
            size="sm"
            onclick={() => secret && salin(secret.callbackSecret, 'Callback Secret')}
          >
            <Icon name="copy" size={14} />
            Salin
          </Button>
        </div>
        <p class="mt-1.5 text-xs text-faint">
          Dipakai untuk verifikasi signature webhook di server kamu.
        </p>
      </div>
    {/if}
    <Button block onclick={() => (secret = null)}>Sudah Disimpan, Tutup</Button>
  </div>
</Modal>
