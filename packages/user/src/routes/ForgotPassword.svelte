<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import AuthLayout from '../components/layout/AuthLayout.svelte';
  import Button from '../components/ui/Button.svelte';
  import Input from '../components/ui/Input.svelte';
  import Icon from '../components/ui/Icon.svelte';

  let email = $state('');
  let loading = $state(false);
  let sent = $state(false);
  let error = $state('');

  async function handleSubmit() {
    error = '';
    loading = true;
    try {
      await api.post('/auth/forgot-password', { email });
      sent = true;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Terjadi kesalahan';
    } finally {
      loading = false;
    }
  }
</script>

<AuthLayout title="Lupa password" subtitle="Kami kirim link reset ke email kamu.">
  {#if sent}
    <div class="flex flex-col items-start gap-3">
      <div
        class="flex h-11 w-11 items-center justify-center rounded-[10px] border border-success/30 bg-success/10 text-success"
      >
        <Icon name="check" size={20} />
      </div>
      <p class="text-sm text-muted">
        Jika email terdaftar, link reset password telah dikirim. Periksa inbox kamu.
      </p>
      <Button block onclick={() => push('/login')}>Kembali ke login</Button>
    </div>
  {:else}
    {#if error}
      <div
        class="mb-4 rounded-lg border border-error/30 bg-error/10 px-3.5 py-2.5 text-sm text-error"
        role="alert"
      >
        {error}
      </div>
    {/if}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      class="space-y-4"
    >
      <Input
        label="Email"
        type="email"
        value={email}
        oninput={(e) => (email = (e.target as HTMLInputElement).value)}
        required
      />
      <Button type="submit" block size="lg" loading={loading}>Kirim link reset</Button>
    </form>
  {/if}

  {#snippet footer()}
    <button class="font-medium text-accent hover:text-accent-strong" onclick={() => push('/login')}>
      ← Kembali ke login
    </button>
  {/snippet}
</AuthLayout>
