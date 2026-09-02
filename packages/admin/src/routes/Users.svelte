<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import Card from '../components/ui/Card.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Button from '../components/ui/Button.svelte';
  import Pagination from '../components/ui/Pagination.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import EmptyState from '../components/ui/EmptyState.svelte';
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

<div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <h2 class="text-xl font-semibold">Pengguna</h2>
</div>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={() => load()} />
{:else if data && data.items.length === 0}
  <EmptyState message="Tidak ada pengguna." />
{:else if data}
  <Card>
    <table class="w-full text-left text-sm">
      <thead class="border-b border-neutral-100">
        <tr>
          <th class="px-4 py-3 font-medium text-neutral-400">Email</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Nama</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Tier</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Status</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Dibuat</th>
          <th class="px-4 py-3 font-medium text-neutral-400">Aksi</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-neutral-100">
        {#each data.items as u}
          <tr class="hover:bg-neutral-50">
            <td class="px-4 py-3 text-sm">{u.email}</td>
            <td class="px-4 py-3 text-sm">{u.name}</td>
            <td class="px-4 py-3"><Badge status={u.tier} /></td>
            <td class="px-4 py-3"><Badge status={u.status} /></td>
            <td class="px-4 py-3 text-neutral-400">-</td>
            <td class="px-4 py-3">
              <div class="flex gap-2">
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
      </tbody>
    </table>
    <Pagination page={data.page} perPage={data.per_page} total={data.total} onPageChange={(p) => load(p)} />
  </Card>
{/if}