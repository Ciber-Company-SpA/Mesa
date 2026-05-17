import { useCallback, useEffect, useRef, useState } from "react"
 
// ─── Error helpers ────────────────────────────────────────────────────────────
 
function getErrorText(err: unknown): string {
  if (err instanceof Error) return `${err.name} ${err.message}`.toLowerCase()
  if (typeof err === "string") return err.toLowerCase()
  if (typeof err !== "object" || err === null) return ""
 
  return ["name", "message", "code", "status"]
    .map((key) => {
      const value = (err as Record<string, unknown>)[key]
      return typeof value === "string" || typeof value === "number"
        ? String(value)
        : ""
    })
    .join(" ")
    .toLowerCase()
}
 
/**
 * Detecta si un error es de red.
 *
 * Prioriza la propiedad explícita `isNetworkError` para evitar falsos positivos
 * con strings genéricos como "fetch" o "failed to fetch user preferences".
 */
export function isNetworkError(err: unknown): boolean {
  // Escape hatch explícito: el código propio puede marcar errores propios
  if (
    typeof err === "object" &&
    err !== null &&
    (err as Record<string, unknown>).isNetworkError === true
  ) {
    return true
  }
 
  const errorText = getErrorText(err)
  if (!errorText) return false
 
  // Patrones estrictos — evitamos "fetch" suelto para reducir falsos positivos
  return (
    errorText.includes("failed to fetch") ||
    errorText.includes("networkerror") ||
    errorText.includes("network request failed") ||
    errorText.includes("load failed") ||
    errorText.includes("internet disconnected") ||
    errorText.includes("err_internet_disconnected") ||
    errorText.includes("authretryablefetcherror") ||
    // TypeError sin mensaje útil suele ser error de red en fetch
    (err instanceof TypeError && errorText === "typeerror failed to fetch") ||
    (err instanceof TypeError && errorText === "typeerror load failed")
  )
}
 
// ─── Backoff ──────────────────────────────────────────────────────────────────
 
interface BackoffOptions {
  /** Delay inicial en ms. Default: 3000 */
  initialDelay?: number
  /** Factor multiplicador por intento. Default: 2 */
  factor?: number
  /** Delay máximo en ms. Default: 30_000 */
  maxDelay?: number
}
 
function computeDelay(attempt: number, opts: Required<BackoffOptions>): number {
  const raw = opts.initialDelay * Math.pow(opts.factor, attempt)
  return Math.min(raw, opts.maxDelay)
}
 
// ─── Hook ─────────────────────────────────────────────────────────────────────
 
interface UseOfflineRetryOptions extends BackoffOptions {}
 
interface UseOfflineRetryResult<T> {
  /** Ejecuta la función. Si falla por red, activa el modo retry. */
  run: () => Promise<T>
  /** true mientras haya un retry pendiente. */
  isPending: boolean
  /** Cancela el retry en curso manualmente. */
  cancel: () => void
}
 
export function useOfflineRetry<T = void>(
  fn: () => Promise<T>,
  {
    initialDelay = 3_000,
    factor = 2,
    maxDelay = 30_000,
  }: UseOfflineRetryOptions = {}
): UseOfflineRetryResult<T> {
  const [isPending, setIsPending] = useState(false)
 
  const fnRef = useRef(fn)
  const isMountedRef = useRef(true)
  const isRetryingRef = useRef(false)
  const attemptRef = useRef(0)
 
  // Mantiene fn actualizada sin re-suscribir efectos
  useEffect(() => {
    fnRef.current = fn
  }, [fn])
 
  // Guard de desmontado
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])
 
  const safeSetPending = useCallback((value: boolean) => {
    if (isMountedRef.current) setIsPending(value)
  }, [])
 
  const cancel = useCallback(() => {
    attemptRef.current = 0
    safeSetPending(false)
  }, [safeSetPending])
 
  useEffect(() => {
    if (!isPending) return
 
    const backoffOpts: Required<BackoffOptions> = { initialDelay, factor, maxDelay }
 
    async function retry() {
      if (isRetryingRef.current) return
      isRetryingRef.current = true
 
      try {
        await fnRef.current()
        attemptRef.current = 0
        safeSetPending(false)
      } catch (err) {
        if (!isNetworkError(err)) {
          // Error no relacionado con red: dejamos de reintentar
          attemptRef.current = 0
          safeSetPending(false)
        }
        // Si sigue siendo error de red, el próximo tick del intervalo reintentará
      } finally {
        isRetryingRef.current = false
      }
    }
 
    const delay = computeDelay(attemptRef.current, backoffOpts)
    attemptRef.current += 1
 
    const timeoutId = window.setTimeout(retry, delay)
    window.addEventListener("online", retry)
 
    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener("online", retry)
    }
    // isPending como dep. garantiza que cada ciclo recalcula el delay con backoff
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, attemptRef.current])
 
  const run = useCallback(async (): Promise<T> => {
    try {
      const result = await fnRef.current()
      // Éxito limpio: reinicia el contador de intentos
      attemptRef.current = 0
      return result
    } catch (err) {
      if (isNetworkError(err)) safeSetPending(true)
      throw err
    }
  }, [safeSetPending])
 
  return { run, isPending, cancel }
}
 