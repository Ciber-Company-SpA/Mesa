import { useCallback, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useCache } from "@/hooks/useCache"

type OrderStats = {
  dailySales: number
  completedOrders: number
}

type OrderStatsRow = {
  total: number | null
  status_id: number | null
  order_status: { status_name: string | null } | { status_name: string | null }[] | null
}

function getStatusName(orderStatus: OrderStatsRow["order_status"]) {
  if (Array.isArray(orderStatus)) return orderStatus[0]?.status_name ?? ""
  return orderStatus?.status_name ?? ""
}

function isCompletedOrder(row: OrderStatsRow) {
  const statusName = getStatusName(row.order_status).toLowerCase()

  return (
    row.status_id === 4 ||
    statusName.includes("pagado") ||
    statusName.includes("cerrado")
  )
}

export function useOrderStats() {
  const { restaurantId, loading: loadingId, error: idError } = useRestaurantId()

  const todayKey = new Date().toISOString().slice(0, 10)

  const fetchStats = useCallback(async (): Promise<OrderStats> => {
    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)

    const startOfTomorrow = new Date(startOfDay)
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

    const { data, error } = await supabase
      .from("orders")
      .select("total, status_id, order_status(status_name)")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", startOfDay.toISOString())
      .lt("created_at", startOfTomorrow.toISOString())

    if (error) throw error

    const rows = (data ?? []) as unknown as OrderStatsRow[]
    const completedRows = rows.filter(isCompletedOrder)

    return {
      dailySales: completedRows.reduce((sum, row) => sum + Number(row.total ?? 0), 0),
      completedOrders: completedRows.length,
    }
  }, [restaurantId])

  const { data, isLoading, isPendingRetry, error } = useCache<OrderStats>(
    `order-stats-${restaurantId ?? "pending"}-${todayKey}`,
    fetchStats,
    { enabled: Boolean(restaurantId), revalidateOnMount: true }
  )

  useEffect(() => {
    if (error && !idError) {
      logger.error("Error cargando estadisticas", error)
    }
  }, [error, idError])

  return {
    dailySales: data?.dailySales ?? 0,
    completedOrders: data?.completedOrders ?? 0,
    loading: loadingId || isLoading || isPendingRetry,
    error: idError || (error ? "Error al cargar estadisticas" : ""),
  }
}
