<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { workspaces } from '../stores/workspace';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';
  import Modal from '../components/ui/Modal.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import Icon from '../components/ui/Icon.svelte';

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
    } catch (e) {
      error = (e as Error).message;
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
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      submitting = false;
    }
  }
</script>

<div class="mb-5 flex items-center justify-end">
  <Button onclick={() => (showCreate = true)}>
    <Icon name="plus" size={16} />
    Buat Workspace
  </Button>
</div>

{#if loading}
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each [1, 2, 3] as n (n)}
      <div class="skeleton h-[118px] rounded-[10px]"></div>
    {/each}
  </div>
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else if $workspaces.length === 0}
  <EmptyState
    title="Belum ada workspace"
    message="Workspace mengelompokkan aplikasi dan pembayaran kamu."
    icon="workspaces"
  >
    <Button onclick={() => (showCreate = true)}>
      <Icon name="plus" size={16} />
      Buat Workspace
    </Button>
  </EmptyState>
{:else}
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each $workspaces as ws (ws.id)}
      <a
        href="#/workspaces/{ws.id}"
        class="group block rounded-[10px] border border-border bg-surface p-4 transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-card sm:p-5"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="truncate font-semibold text-text group-hover:text-accent">{ws.name}</h3>
            <p class="num mt-0.5 truncate text-xs text-faint">{ws.slug}</p>
          </div>
          <span class="mt-0.5 flex-none text-faint transition-colors duration-150 group-hover:text-accent">
            <Icon name="chevron-right" size={16} />
          </span>
        </div>
        <div class="mt-4 flex items-center gap-4 border-t border-dashed border-border pt-3 text-xs text-muted">
          <span class="inline-flex items-center gap-1.5">
            <Icon name="apps" size={14} class="text-faint" />
            <span class="num">{ws.app_count ?? 0}</span> App
          </span>
          <span class="inline-flex items-center gap-1.5">
            <Icon name="overview" size={14} class="text-faint" />
            <span class="num">{ws.member_count ?? 0}</span> Anggota
          </span>
        </div>
      </a>
    {/each}
  </div>
{/if}

<Modal open={showCreate} title="Buat Workspace" onClose={() => (showCreate = false)}>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      create();
    }}
    class="space-y-4"
  >
    <Input
      label="Nama"
      value={newName}
      oninput={(e) => (newName = (e.target as HTMLInputElement).value)}
      required
    />
    <Input
      label="Slug"
      value={newSlug}
      oninput={(e) => (newSlug = (e.target as HTMLInputElement).value)}
      required
      placeholder="my-workspace"
    />
    <Button type="submit" block loading={submitting}>Buat</Button>
  </form>
</Modal>
