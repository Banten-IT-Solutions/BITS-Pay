<script lang="ts">
  // Input QRIS static: paste teks atau upload gambar QR (decode di browser via jsQR).
  import jsQR from 'jsqr';
  import { isValidQris, parseQris } from 'bits-qris/core';
  import Icon from './ui/Icon.svelte';

  interface Props {
    value?: string;
    label?: string;
    hint?: string;
  }
  let {
    value = $bindable(''),
    label = 'QRIS Static',
    hint = 'Salin payload QRIS static dari QRIS merchant milikmu, atau upload gambar kode QR-nya. Dana pembayaran akan langsung masuk ke rekening merchant tersebut.',
  }: Props = $props();
  const inputId = $props.id();

  const MAX_FILE_BYTES = 5 * 1024 * 1024;

  let decoding = $state(false);
  let uploadError = $state('');
  let uploadOk = $state(false);

  // Konfirmasi nama merchant bila payload valid — bantu user yakin QRIS-nya benar.
  const merchantName = $derived.by(() => {
    const v = value.trim();
    if (!v || !isValidQris(v)) return '';
    try {
      return parseQris(v).merchantName?.trim() ?? '';
    } catch {
      return '';
    }
  });

  async function onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // reset supaya file yang sama bisa dipilih ulang
    if (!file) return;
    uploadError = '';
    uploadOk = false;
    if (file.size > MAX_FILE_BYTES) {
      uploadError = 'Ukuran gambar maksimal 5MB';
      return;
    }
    decoding = true;
    try {
      const bmp = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas tidak tersedia');
      ctx.drawImage(bmp, 0, 0);
      const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
      bmp.close();
      const qr = jsQR(img.data, img.width, img.height);
      if (!qr?.data) {
        uploadError = 'QR tidak terdeteksi di gambar';
        return;
      }
      value = qr.data.trim();
      uploadOk = true;
    } catch {
      uploadError = 'File bukan gambar yang bisa dibaca';
    } finally {
      decoding = false;
    }
  }
</script>

<div>
  <label for={inputId} class="mb-1.5 block text-[13px] font-medium text-muted">
    {label} <span class="text-error">*</span>
  </label>
  <textarea
    id={inputId}
    class="min-h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-text"
    placeholder="00020101021126..."
    bind:value
    oninput={() => {
      uploadOk = false;
      uploadError = '';
    }}
  ></textarea>
  <div class="mt-2 flex items-center gap-2">
    <label
      class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-text {decoding
        ? 'pointer-events-none opacity-60'
        : ''}"
    >
      <Icon name="qr" size={14} />
      {decoding ? 'Membaca gambar…' : 'Upload Gambar QRIS'}
      <input type="file" accept="image/*" class="sr-only" onchange={onFile} disabled={decoding} />
    </label>
    {#if uploadOk}
      <span class="flex items-center gap-1 text-xs text-success">
        <Icon name="check" size={13} />
        QR terdeteksi dari gambar
      </span>
    {/if}
  </div>
  {#if uploadError}
    <p class="mt-1.5 text-xs text-error" role="alert">{uploadError}</p>
  {:else if merchantName}
    <p class="mt-1.5 text-xs text-success">Merchant terdeteksi: {merchantName}</p>
  {:else}
    <p class="mt-1.5 text-xs text-faint">{hint}</p>
  {/if}
</div>
