<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Button from '../components/ui/Button.svelte';
  import Pagination from '../components/ui/Pagination.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
  import DataTable, { bodyCell, type TableHeader } from '../components/ui/DataTable.svelte';
  import { showToast } from '../lib/toast';
  import type { UserPublic, UserTier, UserStatus } from '@bits-pay/shared';

  interface UserPage {
    items: UserPublic[];
    total: number;
    page: number;
    per_page: number;
  }

  let data = $state<UserPage | null>(null);
  let loading = $state(true);
  let error = $state('');
  let currentPage = $state(1);
  let actionLoading = $state<string | null>(null);

  const headers: TableHeader[] = [
    { label: 'Email' },
    { label: 'Nama', class: 'hidden md:table-cell' },
    { label: 'Tier' },
    { label: 'Status' },
    { label: 'Aksi', align: 'right' },
  ];

  async function load(page = 1) {
    loading = true;
    error = '';
    currentPage = page;
    try {
      const qs = new URLSearchParams({ page: String(page), per_page: '20' });
      data = await api.get<UserPage>(`/admin/users?${qs}`);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(() => load());

  async function handleToggleStatus(user: UserPublic) {
    actionLoading = user.id;
    try {
      const newStatus: UserStatus = user.status === 'active' ? 'suspended' : 'active';
      await api.put(`/admin/users/${user.id}`, { status: newStatus });
      showToast(`User ${newStatus === 'active' ? 'diaktifkan' : 'disuspend'}`, 'success');
      await load(currentPage);
    } catch (e) {
      showToast((e as Error).message || 'Gagal update status', 'error');
    } finally {
      actionLoading = null;
    }
  }

  async function handleToggleTier(user: UserPublic) {
    actionLoading = user.id;
    try {
      const newTier: UserTier = user.tier === 'free' ? 'premium' : 'free';
      await api.put(`/admin/users/${user.id}`, { tier: newTier });
      showToast(`Tier diubah ke ${newTier === 'free' ? 'Free' : 'Premium'}`, 'success');
      await load(currentPage);
    } catch (e) {
      showToast((e as Error).message || 'Gagal update tier', 'error');
    } finally {
      actionLoading = null;
    }
  }
</script>

<div class="mb-4">
  <p class="text-[13px] text-neutral-600">
    {#if data && !loading}
      <span class="num font-medium text-neutral-900">{data.total.toLocaleString('id-ID')}</span> pengguna terdaftar
    {:else}
      Semua pengguna terdaftar
    {/if}
  </p>
</div>

{#if error && !data}
  <ErrorState {error} onRetry={() => load()} />
{:else if data && data.items.length === 0 && !loading}
  <EmptyState message="Tidak ada pengguna." icon="users" />
{:else}
  <Card padding={false}>
    <DataTable {headers} loading={loading && !data} stickyFirst>
      {#each data?.items ?? [] as u (u.id)}
        {@const h = headers}
        <tr class="transition-colors hover:bg-primary-50/50">
          <td class="{bodyCell(h[0], 0, true)} font-medium text-neutral-900">{u.email}</td>
          <td class="{bodyCell(h[1], 1, true)} text-neutral-600">{u.name}</td>
          <td class={bodyCell(h[2], 2, true)}><Badge status={u.tier} /></td>
          <td class={bodyCell(h[3], 3, true)}><Badge status={u.status} /></td>
          <td class={bodyCell(h[4], 4, true)}>
            <div class="flex justify-end gap-1.5">
              <Button
                size="sm"
                variant={u.status === 'active' ? 'danger' : 'secondary'}
                loading={actionLoading === u.id}
                onclick={() => handleToggleStatus(u)}
              >
                {u.status === 'active' ? 'Suspend' : 'Aktifkan'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={actionLoading === u.id}
                onclick={() => handleToggleTier(u)}
              >
                {u.tier === 'free' ? 'Ke Premium' : 'Ke Free'}
              </Button>
            </div>
          </td>
        </tr>
      {/each}
    </DataTable>
    {#if data}
      <Pagination page={data.page} perPage={data.per_page} total={data.total} onPageChange={(p) => load(p)} />
    {/if}
  </Card>
{/if}
