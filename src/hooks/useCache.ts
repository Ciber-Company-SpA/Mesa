import { useCallback, useEffect, useState } from "react"
import { isNetworkError, useOfflineRetry } from "./useOfflineRetry"

type CacheOptions = {
  ttl?: number
  enabled?: boolean
  revalidateOnMount?: boolean
  initialDelay?: number
  factor?: number
  maxDelay?: number
}

type CacheState<T> = {
  data: T | null
  isFromCache: boolean
  isLoading: boolean
  isPendingRetry: boolean
  error: unknown
  refresh: () => void
  cancel: () => void
}

function readCache<T>(key: string, ttl?: number): T | null {
  try {
    if (typeof window === "undefined") return null

    const raw = localStorage.getItem(key)
    if (!raw) return null

    const { data, ts } = JSON.parse(raw) as { data: T; ts: number }
    if (ttl !== undefined && Date.now() - ts > ttl) return null

    return data
  } catch {
    return null
  }
}

export function writeCache<T>(key: string, data: T): void {
  try {
    if (typeof window === "undefined") return

    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }))
  } catch {
    // localStorage can be full or blocked; cached reads are best-effort.
  }
}

export function invalidateCache(keyOrPrefix: string): void {
  try {
    if (typeof window === "undefined") return

    if (keyOrPrefix.endsWith(":*")) {
      const prefix = keyOrPrefix.slice(0, -2)
      const keys = Object.keys(localStorage)
      keys.forEach((k) => {
        if (k.startsWith(prefix)) {
          localStorage.removeItem(k)
        }
      })
      return
    }

    localStorage.removeItem(keyOrPrefix)
  } catch {
  }
}


export function useCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  { ttl, enabled = true, revalidateOnMount = false, initialDelay, factor, maxDelay }: CacheOptions = {}
): CacheState<T> {
  const [data, setData] = useState<T | null>(() => (enabled ? readCache<T>(key, ttl) : null))
  const [isFromCache, setIsFromCache] = useState(() => enabled && data !== null)
  const [isLoading, setIsLoading] = useState(() => enabled && data === null)
  const [error, setError] = useState<unknown>(null)

  const fetcherForRetry = useCallback(async (): Promise<T> => {
    const result = await fetcher()

    writeCache(key, result)
    setData(result)
    setIsFromCache(false)
    setIsLoading(false)
    setError(null)

    return result
  }, [key, fetcher])

  const { run, isPending: isPendingRetry, cancel } = useOfflineRetry(fetcherForRetry, {
    initialDelay,
    factor,
    maxDelay,
  })

  useEffect(() => {
    if (!enabled) {
      cancel()
      queueMicrotask(() => {
        setData(null)
        setIsFromCache(false)
        setIsLoading(false)
        setError(null)
      })
      return
    }

    const cached = readCache<T>(key, ttl)

    if (cached !== null) {
      queueMicrotask(() => {
        setData(cached)
        setIsFromCache(true)
        setIsLoading(false)
        setError(null)
      })

      if (revalidateOnMount) {
        run().catch((err) => {
          if (!isNetworkError(err)) setError(err)
        })
      }

      return
    }

    queueMicrotask(() => {
      setData(null)
      setIsFromCache(false)
      setIsLoading(true)
      setError(null)
    })

    run().catch((err) => {
      if (!isNetworkError(err)) {
        setError(err)
        setIsLoading(false)
      }
    })
  }, [cancel, enabled, key, revalidateOnMount, run, ttl])

  useEffect(() => {
    if (!enabled) return

    function refreshFromCache() {
      if (!isFromCache) return

      fetcher()
        .then((fresh) => {
          writeCache(key, fresh)
          setData(fresh)
          setIsFromCache(false)
          setError(null)
        })
        .catch(() => {
          // Keep the cached data visible if the background refresh fails.
        })
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        refreshFromCache()
      }
    }

    window.addEventListener("online", refreshFromCache)
    window.addEventListener("focus", refreshFromCache)
    document.addEventListener("visibilitychange", refreshWhenVisible)

    return () => {
      window.removeEventListener("online", refreshFromCache)
      window.removeEventListener("focus", refreshFromCache)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
    }
  }, [enabled, key, fetcher, isFromCache])

  const refresh = useCallback(() => {
    if (!enabled) return

    setIsLoading(true)
    setError(null)

    run().catch((err) => {
      if (!isNetworkError(err)) {
        setError(err)
        setIsLoading(false)
      }
    })
  }, [enabled, run])

  return {
    data,
    isFromCache,
    isLoading,
    isPendingRetry,
    error,
    refresh,
    cancel,
  }
}
