<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { auth } from '../stores/auth';
  import Card from '../components/ui/Card.svelte';
  import Button from '../components/ui/Button.svelte';
  import Badge from '../components/ui/Badge.svelte';
  import Input from '../components/ui/Input.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import Icon from '../components/ui/Icon.svelte';
  import { showToast } from '../lib/toast';
  import { formatDate } from '../lib/format';
  import type { UserMe } from '@bits-pay/shared';

  let me = $state<UserMe | null>(null);
  let loading = $state(true);
  let error = $state('');

  // Form Profil
  let name = $state('');
  let email = $state('');
  let currentPasswordForEmail = $state('');
  let savingProfile = $state(false);

  // Form Kata Sandi
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let savingPassword = $state(false);

  const nameChanged = $derived(me ? name.trim() !== me.name : false);
  const emailChanged = $derived(me ? email.trim().toLowerCase() !== me.email.toLowerCase() : false);
  const hasProfileChanges = $derived(nameChanged || emailChanged);

  const passwordMismatch = $derived(
    confirmPassword.length > 0 && newPassword !== confirmPassword,
  );
  const canSubmitPassword = $derived(
    newPassword.length >= 8 &&
      confirmPassword.length > 0 &&
      !passwordMismatch &&
      (!me?.has_password || currentPassword.length > 0) &&
      !savingPassword,
  );

  async function loadProfile() {
    loading = true;
    error = '';
    try {
      const data = await api.get<UserMe>('/auth/me');
      me = data;
      name = data.name;
      email = data.email;
    } catch (e) {
      error = (e as Error).message || 'Gagal memuat profil akun';
    } finally {
      loading = false;
    }
  }

  onMount(loadProfile);

  async function handleSaveProfile(e: Event) {
    e.preventDefault();
    if (!hasProfileChanges || savingProfile) return;

    if (name.trim().length < 2) {
      showToast('Nama minimal 2 karakter', 'error');
      return;
    }

    if (emailChanged && me?.has_password && !currentPasswordForEmail) {
      showToast('Masukkan kata sandi saat ini untuk mengubah email', 'error');
      return;
    }

    savingProfile = true;
    try {
      const res = await api.patch<{
        user: UserMe;
        token?: string;
        message: string;
      }>('/auth/profile', {
        name: nameChanged ? name.trim() : undefined,
        email: emailChanged ? email.trim().toLowerCase() : undefined,
        current_password: emailChanged ? currentPasswordForEmail : undefined,
      });

      if (res.token) {
        auth.setToken(res.token);
      }
      me = res.user;
      name = res.user.name;
      email = res.user.email;
      currentPasswordForEmail = '';
      auth.updateUser({ name: res.user.name, email: res.user.email });
      showToast(res.message || 'Profil berhasil diperbarui', 'success');
    } catch (err) {
      showToast((err as Error).message || 'Gagal memperbarui profil', 'error');
    } finally {
      savingProfile = false;
    }
  }

  async function handleChangePassword(e: Event) {
    e.preventDefault();
    if (!canSubmitPassword) return;

    savingPassword = true;
    try {
      const res = await api.put<{ token: string; message: string }>('/auth/password', {
        current_password: me?.has_password ? currentPassword : undefined,
        new_password: newPassword,
      });

      if (res.token) {
        auth.setToken(res.token);
      }
      if (me) me.has_password = true;
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      showToast(res.message || 'Kata sandi berhasil diperbarui', 'success');
    } catch (err) {
      showToast((err as Error).message || 'Gagal mengubah kata sandi', 'error');
    } finally {
      savingPassword = false;
    }
  }

  function copyUserId() {
    if (!me?.id) return;
    navigator.clipboard.writeText(me.id);
    showToast('ID Pengguna disalin ke clipboard', 'info');
  }
</script>

<div class="mx-auto max-w-5xl space-y-6">
  <!-- Header Halaman -->
  <div>
    <h1 class="font-display text-2xl font-bold tracking-tight text-text">Profil Akun</h1>
    <p class="mt-1 text-sm text-muted">
      Kelola identitas akun, kredensial, dan preferensi keamanan kamu.
    </p>
  </div>

  {#if loading}
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="space-y-6 lg:col-span-2">
        <Card class="p-6">
          <div class="h-6 w-36 animate-pulse rounded bg-surface-2"></div>
          <div class="mt-6 space-y-4">
            <div class="h-10 animate-pulse rounded-lg bg-surface-2"></div>
            <div class="h-10 animate-pulse rounded-lg bg-surface-2"></div>
          </div>
        </Card>
      </div>
      <Card class="p-6">
        <div class="h-16 w-16 animate-pulse rounded-full bg-surface-2"></div>
        <div class="mt-4 h-5 w-32 animate-pulse rounded bg-surface-2"></div>
      </Card>
    </div>
  {:else if error}
    <ErrorState message={error} retry={loadProfile} />
  {:else if me}
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Kolom Kiri: Form Profil & Kata Sandi -->
      <div class="space-y-6 lg:col-span-2">
        <!-- Card 1: Informasi Dasar -->
        <Card class="p-5 sm:p-6">
          <div class="flex items-start gap-3.5 border-b border-border pb-4">
            <div
              class="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-accent-soft text-accent"
            >
              <Icon name="user" size={20} />
            </div>
            <div>
              <h2 class="font-display text-base font-semibold text-text">Informasi Pribadi</h2>
              <p class="text-xs text-muted">
                Nama tampilan dan alamat email kontak untuk akun kamu.
              </p>
            </div>
          </div>

          <form onsubmit={handleSaveProfile} class="mt-5 space-y-4">
            <Input
              label="Nama Lengkap"
              bind:value={name}
              placeholder="Contoh: Budi Santoso"
              required
              disabled={savingProfile}
            />

            <div>
              <Input
                label="Alamat Email"
                type="email"
                bind:value={email}
                placeholder="nama@email.com"
                required
                disabled={savingProfile}
              />
              <div class="mt-2 flex items-center justify-between gap-2">
                <Badge
                  status={me.email_verified ? 'verified' : 'unverified'}
                  label={me.email_verified ? 'Email terverifikasi' : 'Belum terverifikasi'}
                  dot={true}
                />
                {#if emailChanged}
                  <span
                    class="inline-flex items-center rounded-md border border-accent/30 bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-medium text-accent"
                  >
                    Perubahan terdeteksi
                  </span>
                {/if}
              </div>
            </div>

            {#if emailChanged && me.has_password}
              <div
                class="rounded-lg border border-warning/30 bg-warning/5 p-3.5 text-xs text-text animate-[panel-in_150ms_ease-out]"
              >
                <div class="flex items-start gap-2.5">
                  <Icon name="alert" size={16} class="mt-0.5 flex-none text-warning" />
                  <div class="flex-1 space-y-2">
                    <p class="font-medium text-warning">Verifikasi Keamanan</p>
                    <p class="text-muted">
                      Mengubah alamat email memerlukan konfirmasi kata sandi saat ini. Tautan
                      verifikasi baru akan dikirim ke alamat email baru.
                    </p>
                    <Input
                      label="Kata Sandi Saat Ini"
                      type="password"
                      bind:value={currentPasswordForEmail}
                      placeholder="Masukkan kata sandi saat ini"
                      required
                      disabled={savingProfile}
                    />
                  </div>
                </div>
              </div>
            {/if}

            <div class="flex items-center justify-end gap-3 pt-2">
              {#if hasProfileChanges}
                <button
                  type="button"
                  class="text-xs text-muted transition-colors hover:text-text"
                  onclick={() => {
                    if (me) {
                      name = me.name;
                      email = me.email;
                      currentPasswordForEmail = '';
                    }
                  }}
                  disabled={savingProfile}
                >
                  Batal
                </button>
              {/if}
              <Button
                type="submit"
                variant="primary"
                disabled={!hasProfileChanges || savingProfile}
                loading={savingProfile}
              >
                Simpan Perubahan
              </Button>
            </div>
          </form>
        </Card>

        <!-- Card 2: Keamanan & Kata Sandi -->
        <Card class="p-5 sm:p-6">
          <div class="flex items-start gap-3.5 border-b border-border pb-4">
            <div
              class="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-accent-soft text-accent"
            >
              <Icon name="lock" size={20} />
            </div>
            <div>
              <h2 class="font-display text-base font-semibold text-text">Kata Sandi</h2>
              <p class="text-xs text-muted">
                Perbarui kata sandi untuk melindungi keamanan akun BITS Pay kamu.
              </p>
            </div>
          </div>

          {#if !me.has_password}
            <div
              class="mt-4 rounded-lg border border-accent/20 bg-accent-soft p-3.5 text-xs text-text"
            >
              <div class="flex items-start gap-2.5">
                <Icon name="shield" size={16} class="mt-0.5 flex-none text-accent" />
                <p class="text-muted leading-relaxed">
                  Akun ini terhubung via <strong class="text-text">Google OAuth</strong> dan belum
                  memiliki kata sandi mandiri. Kamu dapat membuat kata sandi di bawah untuk masuk
                  langsung menggunakan email dan password.
                </p>
              </div>
            </div>
          {/if}

          <form onsubmit={handleChangePassword} class="mt-5 space-y-4">
            {#if me.has_password}
              <Input
                label="Kata Sandi Saat Ini"
                type="password"
                bind:value={currentPassword}
                placeholder="Masukkan kata sandi saat ini"
                required
                disabled={savingPassword}
              />
            {/if}

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Kata Sandi Baru"
                type="password"
                bind:value={newPassword}
                placeholder="Minimal 8 karakter"
                required
                disabled={savingPassword}
              />
              <Input
                label="Konfirmasi Kata Sandi"
                type="password"
                bind:value={confirmPassword}
                placeholder="Ulangi kata sandi baru"
                required
                disabled={savingPassword}
                error={passwordMismatch ? 'Kata sandi konfirmasi tidak cocok' : ''}
              />
            </div>

            <div class="flex items-center justify-between pt-2">
              <span class="text-[11px] text-faint">
                Sesi di perangkat lain akan otomatis dikeluarkan saat kata sandi diperbarui.
              </span>
              <Button
                type="submit"
                variant="secondary"
                disabled={!canSubmitPassword}
                loading={savingPassword}
              >
                {me.has_password ? 'Perbarui Kata Sandi' : 'Buat Kata Sandi'}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <!-- Kolom Kanan: Ringkasan Akun -->
      <div class="space-y-6">
        <Card class="p-5 sm:p-6">
          <div class="text-center">
            <div
              class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-2xl font-bold text-accent shadow-sm"
            >
              {me.name.charAt(0).toUpperCase()}
            </div>
            <h3 class="mt-3 truncate font-display text-base font-semibold text-text">{me.name}</h3>
            <p class="truncate text-xs text-muted">{me.email}</p>

            <div class="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              <Badge status={me.tier === 'premium' ? 'premium' : 'free'} dot={false} />
              <Badge status={me.status} dot={true} />
              <Badge
                status={me.email_verified ? 'verified' : 'unverified'}
                label={me.email_verified ? 'Terverifikasi' : 'Belum Verifikasi'}
                dot={true}
              />
            </div>
          </div>

          <div class="mt-6 space-y-3 border-t border-border pt-4 text-xs">
            <div>
              <span class="text-faint">ID Pengguna</span>
              <div class="mt-1 flex items-center justify-between rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-[11px] text-text">
                <span class="truncate">{me.id}</span>
                <button
                  type="button"
                  class="ml-2 flex-none text-muted transition-colors hover:text-text"
                  onclick={copyUserId}
                  title="Salin ID Pengguna"
                  aria-label="Salin ID Pengguna"
                >
                  <Icon name="copy" size={13} />
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between py-1">
              <span class="text-faint">Paket Langganan</span>
              <span class="font-medium text-text capitalize">
                {me.tier}
                {#if me.is_trial}
                  <span class="text-accent">(Trial)</span>
                {/if}
              </span>
            </div>

            {#if me.tier_expires_at}
              <div class="flex items-center justify-between py-1">
                <span class="text-faint">Masa Berlaku</span>
                <span class="font-mono text-text">{formatDate(me.tier_expires_at)}</span>
              </div>
            {/if}

            {#if me.created_at}
              <div class="flex items-center justify-between py-1">
                <span class="text-faint">Terdaftar Sejak</span>
                <span class="font-mono text-text">{formatDate(me.created_at)}</span>
              </div>
            {/if}
          </div>

          <div class="mt-6 border-t border-border pt-4">
            <a
              href="#/subscription"
              class="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 text-xs font-medium text-text transition-colors hover:bg-surface hover:border-border-strong"
            >
              <Icon name="subscription" size={14} />
              Kelola Paket Langganan
            </a>
          </div>
        </Card>
      </div>
    </div>
  {/if}
</div>
