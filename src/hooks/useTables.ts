import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useCache } from "@/hooks/useCache"
import type { Table } from "@/types/table"

export function useTables() {
  const { restaurantId, loading: loadingId, error: idError } = useRestaurantId()

  const fetchTables = useCallback(async (): Promise<Table[]> => {
    const { data, error } = await supabase
      .from("tables")
      .select(`
        *,
        qr_codes:table_qr_codes (
          id,
          qr_code,
          qr_active,
          created_at
        )
      `)
      .eq("restaurant_id", restaurantId)
      .order("table_number", { ascending: true })

    if (error) throw error

    return data || []
  }, [restaurantId])

  const { data, isLoading, isPendingRetry, error } = useCache<Table[]>(
  `tables-${restaurantId ?? "pending"}`,
  fetchTables,
  {
    enabled: Boolean(restaurantId),
    revalidateOnMount: true,
    ttl: 10 * 60 * 1000, // 10 minutos
  }
)

  if (error) {
    logger.error("Error cargando mesas", error)
  }

  return {
    tables: data ?? [],
    loading: loadingId || isLoading || isPendingRetry,
    error: idError || (error ? "Error al cargar mesas" : "")
  }
}
