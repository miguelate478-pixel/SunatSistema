/**
 * SUNAT-specific error types for clean error handling
 */

export class SunatAuthError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = "SunatAuthError";
  }
}

export class SunatPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SunatPermissionError";
  }
}

export class SunatTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SunatTokenError";
  }
}

export class SunatDownloadError extends Error {
  constructor(message: string, public readonly voucherId?: string) {
    super(message);
    this.name = "SunatDownloadError";
  }
}

export class SunatNotFoundError extends Error {
  constructor(serie: string, numero: string) {
    super(`Comprobante ${serie}-${numero} no encontrado en SUNAT`);
    this.name = "SunatNotFoundError";
  }
}

/** Convert SUNAT error to a user-friendly message (never expose internals) */
export function toUserMessage(err: unknown): string {
  if (err instanceof SunatAuthError) return "Credenciales SUNAT inválidas. Verifica tu client_id y client_secret.";
  if (err instanceof SunatPermissionError) return "Sin permisos para acceder a este recurso en SUNAT.";
  if (err instanceof SunatTokenError) return "Error al obtener token de SUNAT. Intenta nuevamente.";
  if (err instanceof SunatNotFoundError) return (err as SunatNotFoundError).message;
  if (err instanceof SunatDownloadError) return "Error al descargar documento de SUNAT.";
  return "Error de conexión con SUNAT. Intenta nuevamente.";
}
