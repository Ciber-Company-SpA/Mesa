import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Order } from "@/types/order"
import { useRestaurantId } from "@/hooks/useRestaurantId"

export function useOrders() {
  const { restaurantId, loading: loadingId } = useRestaurantId()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (loadingId || restaurantId === null) return

    async function load() {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("id, table_id, total, status_id, created_at, order_status(nombre), tables(name)")
          .eq("restaurant_id", restaurantId)
          .in("status_id", [1, 2, 3])
          .order("created_at", { ascending: false })
          .limit(10)

        if (error) throw error
        setOrders((data ?? []) as unknown as Order[])
      } catch (err: unknown) {
        setError("No se pudieron obtener los pedidos")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [restaurantId, loadingId])

  const activeOrdersCount = orders.length

  return { orders, activeOrdersCount, loading, error }
}