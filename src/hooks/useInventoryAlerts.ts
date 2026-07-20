"use client"

import { useCallback, useEffect, useId } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useCache } from "@/hooks/useCache"
import type { InventoryAlerts } from "@/types/ingredient"

const EMPTY: InventoryAlerts = { out_count: 0, low_count: 0, items: [] }

/**
 * Alertas de inventario del restaurante actual (insumos sin stock o bajo el
 * mínimo). Alimenta la sección de inventario, la card del dashboard y el
 * badge/campana del sidebar.
 *
 * - Datos vía RPC get_inventory_alerts (SECURITY DEFINER, guard admin).
 * - Cache compartido por restaurante (useCache) + canal realtime en la tabla
 *   `ingredients` (patrón de useOrders): cuando una venta descuenta stock, el
 *   indicador se actualiza en vivo sin recargar.
 */
export function useInventoryAlerts() {
  const { restaurantId } = useRestaurantId()
  const instanceId = useId()

  const fetchAlerts = useCallback(async (): Promise<InventoryAlerts> => {
    const { data, error } = await supabase.rpc("get_inventory_alerts")
    if (error) throw error
    return (data as InventoryAlerts) ?? EMPTY
  }, [])

  const { data, isLoading, isPendingRetry, refresh } = useCache<InventoryAlerts>(
    `inventory-alerts-${restaurantId ?? "pending"}`,
    fetchAlerts,
    { enabled: Boolean(restaurantId), revalidateOnMount: true }
  )

  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel(`inventory-alerts-${restaurantId}-${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ingredients",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => refresh()
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logger.warn(`Realtime inventory-alerts channel: ${status}`)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, refresh, instanceId])

  const alerts = data ?? EMPTY

  return {
    outCount: alerts.out_count,
    lowCount: alerts.low_count,
    totalCount: alerts.out_count + alerts.low_count,
    items: alerts.items,
    loading: isLoading || isPendingRetry,
    refresh,
  }
}
