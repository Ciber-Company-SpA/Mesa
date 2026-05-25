import { useCallback } from "react"
import { logger } from "@/lib/logger"
import { useCache } from "@/hooks/useCache"
import { listWaitersAction } from "@/app/actions/waiter-actions"
import type { WaiterListItem } from "@/services/waiter-service"

export function useWaiters() {
  const fetchWaiters = useCallback(async (): Promise<WaiterListItem[]> => {
    const result = await listWaitersAction()
    if (!result.ok) throw new Error(result.error)
    return result.data
  }, [])

  const { data, isLoading, isPendingRetry, error, refresh } = useCache<WaiterListItem[]>(
    "waiters-list",
    fetchWaiters,
    { revalidateOnMount: true }
  )

  if (error) {
    logger.error("Error cargando meseros", error)
  }

  return {
    waiters: data ?? [],
    loading: isLoading || isPendingRetry,
    error: error ? "No se pudieron cargar los meseros" : "",
    refresh,
  }
}
