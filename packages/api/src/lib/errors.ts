export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(code: string, message: string, details?: Record<string, string[]>) {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(401, 'unauthorized', message);
  }

  static notFound(entity = 'Resource') {
    return new AppError(404, 'not_found', `${entity} tidak ditemukan`);
  }

  static conflict(code: string, message: string) {
    return new AppError(409, code, message);
  }

  static tooMany(message = 'Rate limit tercapai') {
    return new AppError(429, 'rate_limited', message);
  }

  static payloadTooLarge(message = 'Payload terlalu besar') {
    return new AppError(413, 'payload_too_large', message);
  }

  static unsupportedMediaType(message = 'Content-Type tidak didukung') {
    return new AppError(415, 'unsupported_media_type', message);
  }

  static internal(message = 'Internal server error') {
    return new AppError(500, 'internal_error', message);
  }
}
