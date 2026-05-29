import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useCache } from "@/hooks/useCache"
import type { Period } from "@/hooks/useVentasStats"

export type TopProducto = {
  name: string
  totalQuantity: number
  totalRevenue: number
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

export function useTopProductos(period: Period) {
  const { restaurantId, loading: loadingId } = useRestaurantId()
  const todayKey = new Date().toISOString().slice(0, 10)

  const fetchProductos = useCallback(async (): Promise<TopProducto[]> => {
    const { from, to } = getDateRange(period)

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("status_id", 4)
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())

    if (ordersError) throw ordersError

    const orderIds = (orders ?? []).map((o: { id: number }) => o.id)
    if (orderIds.length === 0) return []

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("product_name, product_price, product_quantity")
      .in("order_id", orderIds)

    if (itemsError) throw itemsError

    const map = new Map<string, { qty: number; revenue: number }>()
    for (const item of items ?? []) {
      const name = item.product_name as string
      const qty = Number(item.product_quantity ?? 1)
      const price = Number(item.product_price ?? 0)
      const prev = map.get(name) ?? { qty: 0, revenue: 0 }
      map.set(name, { qty: prev.qty + qty, revenue: prev.revenue + price * qty })
    }

    return Array.from(map.entries())
      .map(([name, { qty, revenue }]) => ({
        name,
        totalQuantity: qty,
        totalRevenue: Math.round(revenue),
      }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 5)
  }, [restaurantId, period])

  const { data, isLoading, isPendingRetry } = useCache<TopProducto[]>(
    `top-productos-${restaurantId ?? "pending"}-${period}-${todayKey}`,
    fetchProductos,
    { enabled: Boolean(restaurantId), revalidateOnMount: true }
  )

  return {
    productos: data ?? [],
    loading: loadingId || isLoading || isPendingRetry,
  }
}
