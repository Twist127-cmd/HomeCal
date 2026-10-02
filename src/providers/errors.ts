export type ProviderErrorCode = "NOT_CONFIGURED" | "DISABLED" | "UNAVAILABLE" | "AUTH_REQUIRED" | "BAD_REQUEST" | "UNKNOWN";

export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ProviderError";
  }
}

export type ProviderStatus = "READY" | "NOT_CONFIGURED" | "DISABLED" | "DISCONNECTED" | "ERROR";
