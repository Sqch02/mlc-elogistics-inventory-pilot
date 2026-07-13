export interface SyncLogger {
  correlationId: string
  info: (...data: unknown[]) => void
  warn: (...data: unknown[]) => void
  error: (...data: unknown[]) => void
}

export function createSyncCorrelationId(): string {
  return crypto.randomUUID()
}

export function createSyncLogger(scope: string, correlationId: string): SyncLogger {
  const prefix = `[${scope}][run:${correlationId}]`

  return {
    correlationId,
    info: (...data) => console.log(prefix, ...data),
    warn: (...data) => console.warn(prefix, ...data),
    error: (...data) => console.error(prefix, ...data),
  }
}
