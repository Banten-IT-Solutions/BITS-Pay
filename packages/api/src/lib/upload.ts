import { AppError } from './errors';

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_MIMES = new Set(['image/jpeg', 'image/png']);

export async function validateProofFile(file: File): Promise<void> {
  if (file.size > MAX_PROOF_BYTES) {
    throw AppError.badRequest('proof_too_large', 'Bukti bayar maksimal 5MB');
  }
  if (!PROOF_MIMES.has(file.type)) {
    throw AppError.badRequest('invalid_proof', 'Bukti bayar harus JPG atau PNG');
  }

  // Magic-byte sniff: file.type bisa dipalsukan client.
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  if (!isJpeg && !isPng) {
    throw AppError.badRequest('invalid_proof', 'File bukan gambar JPG/PNG yang valid');
  }
}
