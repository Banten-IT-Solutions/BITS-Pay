<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Button from '../components/ui/Button.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import type { OcrConfig } from '@bits-pay/shared';

  interface EmailTemplates {
    verify: string;
    reset: string;
    invoice_reminder: string;
  }

  interface OcrTestResult {
    amount: number;
    confidence: number;
    merchant: string;
    rawText: string;
    provider: string;
  }

  let loading = $state(true);
  let error = $state('');

  let templates = $state<EmailTemplates | null>(null);
  let ocrProvider = $state<'workers-ai' | 'tesseract-vps'>('workers-ai');
  let vpsUrl = $state('');
  let vpsKey = $state('');

  let ocrSaving = $state(false);
  let templatesSaving = $state(false);

  let testFile = $state<File | null>(null);
  let testing = $state(false);
  let testResult = $state<OcrTestResult | null>(null);

  function errMsg(e: unknown): string {
    return e instanceof Error ? e.message : 'Terjadi kesalahan';
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const [o, t] = await Promise.all([
        api.get<OcrConfig>('/admin/settings/ocr'),
        api.get<EmailTemplates>('/admin/settings/email-templates'),
      ]);
      ocrProvider = o.ocr_provider;
      vpsUrl = o.vps_ocr_url ?? '';
      vpsKey = o.vps_ocr_api_key ?? '';
      templates = t;
    } catch (e) {
      error = errMsg(e);
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function saveOcr() {
    ocrSaving = true;
    try {
      const body: OcrConfig = { ocr_provider: ocrProvider };
      if (ocrProvider === 'tesseract-vps') {
        body.vps_ocr_url = vpsUrl;
        body.vps_ocr_api_key = vpsKey;
      }
      await api.put('/admin/settings/ocr', body);
      showToast('Pengaturan OCR disimpan', 'success');
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      ocrSaving = false;
    }
  }

  async function saveTemplates() {
    templatesSaving = true;
    try {
      await api.put('/admin/settings/email-templates', templates);
      showToast('Template email disimpan', 'success');
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      templatesSaving = false;
    }
  }

  async function runTest() {
    if (!testFile) {
      showToast('Pilih file bukti dulu', 'warning');
      return;
    }
    testing = true;
    testResult = null;
    try {
      const fd = new FormData();
      fd.append('proof_image', testFile);
      testResult = await api.upload<OcrTestResult>('/admin/settings/ocr/test', fd);
      showToast('Tes OCR selesai', 'success');
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      testing = false;
    }
  }

  function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    testFile = input.files && input.files[0] ? input.files[0] : null;
  }
</script>

<div class="mb-4">
  <h2 class="text-xl font-semibold">Pengaturan</h2>
</div>

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else}
  <div class="space-y-6">
    <Card title="OCR" subtitle="Provider pembacaan bukti transfer">
      <div class="space-y-4">
        <div>
          <p class="mb-2 text-sm font-medium text-neutral-600">Provider</p>
          <label class="mb-1 flex items-center gap-2 text-sm">
            <input type="radio" name="provider" value="workers-ai" bind:group={ocrProvider} />
            Workers AI
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="radio" name="provider" value="tesseract-vps" bind:group={ocrProvider} />
            Tesseract VPS
          </label>
        </div>

        {#if ocrProvider === 'tesseract-vps'}
          <div>
            <label for="vps-ocr-url" class="mb-1 block text-sm font-medium text-neutral-600">VPS OCR URL</label>
            <input id="vps-ocr-url" class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" placeholder="https://..." bind:value={vpsUrl} />
          </div>
          <div>
            <label for="vps-ocr-key" class="mb-1 block text-sm font-medium text-neutral-600">VPS OCR API Key</label>
            <input id="vps-ocr-key" type="password" class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" placeholder="••••••••" bind:value={vpsKey} />
          </div>
        {/if}

        <Button loading={ocrSaving} onclick={saveOcr}>Simpan OCR</Button>
      </div>

      <div class="mt-6 border-t border-neutral-100 pt-6">
        <p class="mb-3 text-sm font-semibold text-neutral-600">Tes OCR</p>
        <div class="mb-3 flex items-center gap-3">
          <input type="file" accept="image/*" class="text-sm" onchange={onFileChange} />
          <Button variant="secondary" loading={testing} disabled={!testFile} onclick={runTest}>Jalankan Tes</Button>
        </div>
        {#if testResult}
          <div class="rounded-lg bg-neutral-50 p-4 text-sm">
            <div class="grid grid-cols-2 gap-2">
              <span class="text-neutral-400">Provider</span>
              <span>{testResult.provider}</span>
              <span class="text-neutral-400">Nominal</span>
              <span class="font-semibold">Rp {testResult.amount.toLocaleString('id-ID')}</span>
              <span class="text-neutral-400">Confidence</span>
              <span>{testResult.confidence}%</span>
              <span class="text-neutral-400">Merchant</span>
              <span>{testResult.merchant || '-'}</span>
            </div>
            {#if testResult.rawText}
              <p class="mt-2 text-neutral-400">Raw Text</p>
              <pre class="mt-1 whitespace-pre-wrap font-mono text-xs text-neutral-600">{testResult.rawText}</pre>
            {/if}
          </div>
        {/if}
      </div>
    </Card>

    {#if templates}
    <Card title="Template Email" subtitle="Isi email untuk verifikasi, reset password & pengingat invoice">
      <div class="space-y-4">
        <div>
          <label for="tmpl-verify" class="mb-1 block text-sm font-medium text-neutral-600">Verifikasi Email</label>
          <textarea id="tmpl-verify" rows="4" class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" bind:value={templates.verify}></textarea>
        </div>
        <div>
          <label for="tmpl-reset" class="mb-1 block text-sm font-medium text-neutral-600">Reset Password</label>
          <textarea id="tmpl-reset" rows="4" class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" bind:value={templates.reset}></textarea>
        </div>
        <div>
          <label for="tmpl-invoice" class="mb-1 block text-sm font-medium text-neutral-600">Pengingat Invoice</label>
          <textarea id="tmpl-invoice" rows="4" class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" bind:value={templates.invoice_reminder}></textarea>
        </div>
        <Button loading={templatesSaving} onclick={saveTemplates}>Simpan Template</Button>
      </div>
    </Card>
{/if}
  </div>
{/if}