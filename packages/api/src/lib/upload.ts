import { AppError } from './errors';

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_MIMES = new Set(['image/jpeg', 'image/png']);

export function validateProofFile(file: File): void {
  if (file.size > MAX_PROOF_BYTES) {
    throw AppError.badRequest('proof_too_large', 'Bukti bayar maksimal 5MB');
  }
  if (!PROOF_MIMES.has(file.type)) {
    throw AppError.badRequest('invalid_proof', 'Bukti bayar harus JPG atau PNG');
  }
}
