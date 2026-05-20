import { useCallback, useEffect, useRef, useState } from "react"

type BackoffOptions = {
  initialDelay?: number
  factor?: number
  maxDelay?: number
}

type UseOfflineRetryResult<T> = {
  run: () => Promise<T>
  isPending: boolean
  cancel: () => void
}

function getErrorText(err: unknown) {
  if (err instanceof Error) return `${err.name} ${err.message}`.toLowerCase()
  if (typeof err === "string") return err.toLowerCase()
  if (typeof err !== "object" || err === null) return ""

  return ["name", "message", "code", "status"]
    .map((key) => {
      const value = (err as Record<string, unknown>)[key]
      return typeof value === "string" || typeof value === "number" ? String(value) : ""
    })
    .join(" ")
    .toLowerCase()
}

function computeDelay(attempt: number, options: Required<BackoffOptions>) {
  const rawDelay = options.initialDelay * Math.pow(options.factor, attempt)
  return Math.min(rawDelay, options.maxDelay)
}

export function isNetworkError(err: unknown) {
  if (
    typeof err === "object" &&
    err !== null &&
    (err as Record<string, unknown>).isNetworkError === true
  ) {
    return true
  }

  const errorText = getErrorText(err)

  return Boolean(
    errorText &&
      (errorText.includes("failed to fetch") ||
        errorText.includes("networkerror") ||
        errorText.includes("network request failed") ||
        errorText.includes("load failed") ||
        errorText.includes("internet disconnected") ||
        errorText.includes("err_internet_disconnected") ||
        errorText.includes("authretryablefetcherror"))
  )
}

export function useOfflineRetry<T = void>(
  fn: () => Promise<T>,
  { initialDelay = 3000, factor = 2, maxDelay = 30000 }: BackoffOptions = {}
): UseOfflineRetryResult<T> {
  const [isPending, setIsPending] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const fnRef = useRef(fn)
  const isMountedRef = useRef(true)
  const isRetryingRef = useRef(false)

  useEffect(() => {
    fnRef.current = fn
  }, [fn])

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
    setAttempt(0)
    safeSetPending(false)
  }, [safeSetPending])

  useEffect(() => {
    if (!isPending) return

    async function retry() {
      if (isRetryingRef.current) return
      isRetryingRef.current = true

      try {
        await fnRef.current()
        setAttempt(0)
        safeSetPending(false)
      } catch (err) {
        if (!isNetworkError(err)) {
          setAttempt(0)
          safeSetPending(false)
          return
        }

        setAttempt((currentAttempt) => currentAttempt + 1)
      } finally {
        isRetryingRef.current = false
      }
    }

    function retryWhenVisible() {
      if (document.visibilityState === "visible") {
        retry()
      }
    }

    const delay = computeDelay(attempt, { initialDelay, factor, maxDelay })
    const timeoutId = window.setTimeout(retry, delay)
    window.addEventListener("online", retry)
    window.addEventListener("focus", retry)
    document.addEventListener("visibilitychange", retryWhenVisible)

    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener("online", retry)
      window.removeEventListener("focus", retry)
      document.removeEventListener("visibilitychange", retryWhenVisible)
    }
  }, [attempt, factor, initialDelay, isPending, maxDelay, safeSetPending])

  const run = useCallback(async (): Promise<T> => {
    try {
      const result = await fnRef.current()
      setAttempt(0)
      safeSetPending(false)
      return result
    } catch (err) {
      if (isNetworkError(err)) {
        setAttempt(0)
        safeSetPending(true)
      }

      throw err
    }
  }, [safeSetPending])

  return { run, isPending, cancel }
}
