import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useCache } from "@/hooks/useCache"
import type { Period } from "@/hooks/useVentasStats"

export type HistorialPedido = {
  id: number
  timeLabel: string
  tableLabel: string
  total: number
  itemsCount: number
}

function getDateRange(period: Period) {
  const now = new Date()
  const to = new Date(now)
  to.setHours(23, 59, 59, 999)
  const from = new Date(now)
  if (period === "hoy") {
    from.setHours(0, 0, 0, 0)
  } else if (period === "semana") {
    from.setDate(from.getDate() - 6)
    from.setHours(0, 0, 0, 0)
  } else {
    from.setDate(from.getDate() - 29)
    from.setHours(0, 0, 0, 0)
  }
  return { from, to }
}

export function useHistorialPedidos(period: Period) {
  const { restaurantId, loading: loadingId } = useRestaurantId()
  const todayKey = new Date().toISOString().slice(0, 10)

  const fetchHistorial = useCallback(async (): Promise<HistorialPedido[]> => {
    const { from, to } = getDateRange(period)

    const { data, error } = await supabase
      .from("orders")
      .select("id, total, created_at, table_id, tables(table_number), order_items(product_quantity)")
      .eq("restaurant_id", restaurantId)
      .eq("status_id", 4)
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: false })
      .limit(30)

    if (error) throw error

    return (data ?? []).map((row: {
      id: number
      total: number
      created_at: string
      table_id: number
      tables: { table_number: number } | { table_number: number }[] | null
      order_items: { product_quantity: number }[]
    }) => {
      const tableNumber = Array.isArray(row.tables)
        ? row.tables[0]?.table_number
        : row.tables?.table_number
      const itemsCount = (row.order_items ?? []).reduce(
        (s: number, i: { product_quantity: number }) => s + Number(i.product_quantity ?? 1),
        0
      )
      return {
        id: row.id,
        timeLabel: new Date(row.created_at).toLocaleString("es-CL", {
          dateStyle: "short",
          timeStyle: "short",
        }),
        tableLabel: tableNumber != null ? `Mesa ${tableNumber}` : `Mesa ${row.table_id}`,
        total: Number(row.total ?? 0),
        itemsCount,
      }
    })
  }, [restaurantId, period])

  const { data, isLoading, isPendingRetry } = useCache<HistorialPedido[]>(
    `historial-pedidos-${restaurantId ?? "pending"}-${period}-${todayKey}`,
    fetchHistorial,
    { enabled: Boolean(restaurantId), revalidateOnMount: true }
  )

  return {
    historial: data ?? [],
    loading: loadingId || isLoading || isPendingRetry,
  }
}
