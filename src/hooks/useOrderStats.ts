import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"

export function useOrderStats() {
  const { restaurantId, loading: loadingId, error: idError } = useRestaurantId()

  const [dailySales, setDailySales] = useState(0)
  const [completedOrders, setCompletedOrders] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const { run: loadStatsWithRetry, isPending } = useOfflineRetry(async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from("orders")
      .select("total")
      .eq("restaurant_id", restaurantId)
      .eq("status_id", 3)
      .gte("created_at", today.toISOString())

    if (error) throw error

    const orders = data ?? []
    setCompletedOrders(orders.length)
    setDailySales(orders.reduce((sum, o) => sum + o.total, 0))
    setError("")
  })

  useEffect(() => {
    if (!restaurantId) return

    async function loadStats() {
      try {
        setLoading(true)
        setError("")
        await loadStatsWithRetry()
      } catch (err: unknown) {
        if (isNetworkError(err)) return
        logger.error("Error cargando estadísticas", err)
        setError("Error al cargar estadísticas")
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [loadStatsWithRetry, restaurantId])

  return {
    dailySales,
    completedOrders,
    loading: loadingId || loading || isPending,
    error: idError || error,
  }
}