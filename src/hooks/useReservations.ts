import { useCallback, useEffect, useId } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useCache } from "@/hooks/useCache"
import type { Reservation } from "@/types/reservation"

const RESERVATION_COLUMNS =
  "id, table_id, restaurant_id, customer_name, customer_phone, party_size, starts_at, ends_at, status, source, notes, created_at, tables(table_number)"

/**
 * Reservas vigentes (activas y que aún no terminaron) del restaurante, ordenadas
 * por hora de inicio. Lee vía RLS con el cliente del navegador (igual que
 * useTables) y se refresca por Realtime ante cualquier cambio.
 */
export function useReservations() {
  const { restaurantId, loading: loadingId, error: idError } = useRestaurantId()
  const instanceId = useId()

  const fetchReservations = useCallback(async (): Promise<Reservation[]> => {
    const { data, error } = await supabase
      .from("table_reservations")
      .select(RESERVATION_COLUMNS)
      .eq("restaurant_id", restaurantId)
      .eq("status", "active")
      .gte("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: true })

    if (error) throw error

    return (data ?? []) as unknown as Reservation[]
  }, [restaurantId])

  const { data, isLoading, isPendingRetry, error, refresh } = useCache<Reservation[]>(
    `reservations-${restaurantId ?? "pending"}`,
    fetchReservations,
    {
      enabled: Boolean(restaurantId),
      revalidateOnMount: true,
      ttl: 60 * 1000,
    }
  )

  if (error) {
    logger.error("Error cargando reservas", error)
  }

  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel(`reservations-${restaurantId}-${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table_reservations",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => refresh()
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logger.warn(`Realtime reservations channel: ${status}`)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, refresh, instanceId])

  return {
    reservations: data ?? [],
    loading: loadingId || isLoading || isPendingRetry,
    error: idError || (error ? "Error al cargar reservas" : ""),
    refresh,
  }
}
