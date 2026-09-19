<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { showToast } from '../lib/toast';
  import Card from '../components/ui/Card.svelte';
  import Button from '../components/ui/Button.svelte';
  import Loading from '../components/ui/Loading.svelte';
  import ErrorState from '../components/ui/ErrorState.svelte';
  import { formatAmount, type OcrConfig } from '@bits-pay/shared';

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

{#if loading}
  <Loading />
{:else if error}
  <ErrorState {error} onRetry={load} />
{:else}
  <div class="max-w-3xl space-y-4">
    <Card title="OCR" subtitle="Provider pembacaan bukti transfer">
      <fieldset>
        <legend class="label">Provider</legend>
        <div class="grid gap-2 sm:grid-cols-2">
          <label
            class="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-sm transition-colors {ocrProvider === 'workers-ai'
              ? 'border-primary-500 bg-primary-50 font-medium text-neutral-900'
              : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}"
          >
            <input type="radio" name="provider" value="workers-ai" bind:group={ocrProvider} class="accent-primary-600" />
            Workers AI
          </label>
          <label
            class="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-sm transition-colors {ocrProvider === 'tesseract-vps'
              ? 'border-primary-500 bg-primary-50 font-medium text-neutral-900'
              : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}"
          >
            <input type="radio" name="provider" value="tesseract-vps" bind:group={ocrProvider} class="accent-primary-600" />
            Tesseract VPS
          </label>
        </div>
      </fieldset>

      {#if ocrProvider === 'tesseract-vps'}
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label for="vps-ocr-url" class="label">VPS OCR URL</label>
            <input id="vps-ocr-url" class="input" placeholder="https://..." bind:value={vpsUrl} />
          </div>
          <div>
            <label for="vps-ocr-key" class="label">VPS OCR API Key</label>
            <input id="vps-ocr-key" type="password" class="input" placeholder="••••••••" bind:value={vpsKey} />
          </div>
        </div>
      {/if}

      <div class="mt-4">
        <Button loading={ocrSaving} onclick={saveOcr}>Simpan OCR</Button>
      </div>

      <div class="mt-6 border-t border-neutral-100 pt-5">
        <p class="label">Tes OCR</p>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="file"
            accept="image/*"
            aria-label="File bukti untuk tes OCR"
            class="w-full rounded-lg border border-dashed border-neutral-200 px-3 py-2.5 text-[13px] text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-neutral-900"
            onchange={onFileChange}
          />
          <Button variant="secondary" loading={testing} disabled={!testFile} onclick={runTest}>Jalankan Tes</Button>
        </div>
        {#if testResult}
          <div class="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-[13px]">
            <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              <dt class="text-neutral-600">Provider</dt>
              <dd class="font-mono text-xs text-neutral-900">{testResult.provider}</dd>
              <dt class="text-neutral-600">Nominal</dt>
              <dd class="num font-semibold text-neutral-900">{formatAmount(testResult.amount)}</dd>
              <dt class="text-neutral-600">Confidence</dt>
              <dd class="num text-neutral-900">{testResult.confidence}%</dd>
              <dt class="text-neutral-600">Merchant</dt>
              <dd class="text-neutral-900">{testResult.merchant || '-'}</dd>
            </dl>
            {#if testResult.rawText}
              <p class="mt-3 text-xs font-medium text-neutral-600">Raw Text</p>
              <pre class="mt-1 overflow-x-auto rounded-md bg-white p-2 font-mono text-xs whitespace-pre-wrap text-neutral-600">{testResult.rawText}</pre>
            {/if}
          </div>
        {/if}
      </div>
    </Card>

    {#if templates}
      <Card title="Template Email" subtitle="Isi email untuk verifikasi, reset password & pengingat invoice">
        <div class="space-y-4">
          <div>
            <label for="tmpl-verify" class="label">Verifikasi Email</label>
            <textarea id="tmpl-verify" rows="4" class="input font-mono text-xs" bind:value={templates.verify}></textarea>
          </div>
          <div>
            <label for="tmpl-reset" class="label">Reset Password</label>
            <textarea id="tmpl-reset" rows="4" class="input font-mono text-xs" bind:value={templates.reset}></textarea>
          </div>
          <div>
            <label for="tmpl-invoice" class="label">Pengingat Invoice</label>
            <textarea id="tmpl-invoice" rows="4" class="input font-mono text-xs" bind:value={templates.invoice_reminder}></textarea>
          </div>
          <Button loading={templatesSaving} onclick={saveTemplates}>Simpan Template</Button>
        </div>
      </Card>
    {/if}
  </div>
{/if}
