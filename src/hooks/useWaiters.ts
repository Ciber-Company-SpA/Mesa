import { useCallback, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useCache } from "@/hooks/useCache"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { listWaitersAction } from "@/app/actions/waiter-actions"
import type { WaiterListItem } from "@/services/waiter-service"

export function useWaiters() {
  const { restaurantId } = useRestaurantId()

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

  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel(`waiters-list-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => refresh()
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logger.warn(`Realtime waiters-list channel: ${status}`)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, refresh])

  return {
    waiters: data ?? [],
    loading: isLoading || isPendingRetry,
    error: error ? "No se pudieron cargar los meseros" : "",
    refresh,
  }
}
