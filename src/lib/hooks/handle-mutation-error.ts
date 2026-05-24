import { logger } from "@/lib/logger"
import { isNetworkError } from "@/hooks/useOfflineRetry"

type HandleMutationErrorOptions = {
  logTag: string
  fallback: string
  setError: (message: string) => void
}

/**
 * Centraliza el catch repetido en hooks de mutación: ignora errores de red
 * (offline retry los maneja), reporta a Sentry y setea el mensaje de error.
 * Retorna true si fue un error de red — caller suele hacer `return`.
 */
export function handleMutationError(
  err: unknown,
  { logTag, fallback, setError }: HandleMutationErrorOptions
): boolean {
  if (isNetworkError(err)) return true

  logger.error(logTag, err)
  setError(err instanceof Error ? err.message : fallback)
  return false
}
