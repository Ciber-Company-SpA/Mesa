import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useOfflineRetry, isNetworkError } from "@/hooks/useOfflineRetry"
import { handleMutationError } from "@/lib/hooks/handle-mutation-error"
import {
  listActiveOrdersAction,
  advanceOrderStatusAction,
  markOrderAsPaidAction,
} from "@/app/actions/order-actions"
import type { WaiterOrder } from "@/services/order-service"

/**
 * Carga las órdenes activas del restaurante y se suscribe a cambios en
 * realtime (orders + order_items). Cualquier cambio dispara un re-fetch — más
 * simple y robusto que hacer merges manuales por evento.
 */
export function useWaiterOrders(restaurantId: number | null) {
  const [orders, setOrders] = useState<WaiterOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [advancingId, setAdvancingId] = useState<number | null>(null)

  const restaurantIdRef = useRef(restaurantId)
  useEffect(() => {
    restaurantIdRef.current = restaurantId
  }, [restaurantId])

  const fetchOrders = useCallback(async () => {
    const rid = restaurantIdRef.current
    if (!rid) return
    const result = await listActiveOrdersAction(rid)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setOrders(result.data)
    setError("")
  }, [])

  const fetchRetry = useOfflineRetry(fetchOrders)

  const reload = useCallback(async () => {
    try {
      await fetchRetry.run()
    } catch (err) {
      if (isNetworkError(err)) return
      logger.error("Error cargando órdenes", err)
    }
  }, [fetchRetry])

  useEffect(() => {
    if (!restaurantId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- transición a estado idle cuando no hay restaurante.
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetchOrders()
      .catch((err) => {
        if (cancelled) return
        if (isNetworkError(err)) return
        logger.error("Error cargando órdenes (init)", err)
        setError("No se pudieron cargar las órdenes")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [restaurantId, fetchOrders])

  useEffect(() => {
    if (!restaurantId) return

    const refetch = () => {
      fetchOrders().catch(() => undefined)
    }

    const channel = supabase
      .channel(`waiter-orders-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        refetch
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        refetch
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logger.warn(`Realtime orders channel: ${status}`)
        }
      })

    const onVisible = () => {
      if (document.visibilityState === "visible") refetch()
    }
    window.addEventListener("focus", refetch)
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener("focus", refetch)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [restaurantId, fetchOrders])

  const advance = useCallback(
    async (orderId: number): Promise<boolean> => {
      if (advancingId) return false
      try {
        setAdvancingId(orderId)
        setError("")
        const result = await advanceOrderStatusAction(orderId)
        if (!result.ok) {
          setError(result.error)
          return false
        }
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id !== orderId) return o
            const next: WaiterOrder = { ...o, statusId: result.data.statusId }
            // Cuando recien pasa a Listo, congelamos readyAt localmente para
            // que el promedio no use el tiempo en vivo hasta que llegue el
            // evento Realtime con el valor real seteado por el trigger.
            if (result.data.statusId === 3 && !o.readyAt) {
              next.readyAt = new Date().toISOString()
            }
            return next
          })
        )
        return true
      } catch (err) {
        handleMutationError(err, {
          logTag: "Error avanzando orden",
          fallback: "Error al avanzar la orden",
          setError,
        })
        return false
      } finally {
        setAdvancingId(null)
      }
    },
    [advancingId]
  )

  const markPaid = useCallback(
    async (orderId: number): Promise<boolean> => {
      if (advancingId) return false
      try {
        setAdvancingId(orderId)
        setError("")
        const result = await markOrderAsPaidAction(orderId)
        if (!result.ok) {
          setError(result.error)
          return false
        }
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, statusId: result.data.statusId } : o))
        )
        return true
      } catch (err) {
        handleMutationError(err, {
          logTag: "Error marcando orden como pagada",
          fallback: "Error al marcar como pagada",
          setError,
        })
        return false
      } finally {
        setAdvancingId(null)
      }
    },
    [advancingId]
  )

  return { orders, loading, error, advance, markPaid, advancingId, reload }
}
