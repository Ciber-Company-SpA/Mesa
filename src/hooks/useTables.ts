import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useCache } from "@/hooks/useCache"
import type { Table } from "@/types/table"

type UseTablesOptions = {
  page?: number
  pageSize?: number
}

type TablesResult = {
  items: Table[]
  total: number
}

export function useTables({ page = 1, pageSize = 12 }: UseTablesOptions = {}) {
  const { restaurantId, loading: loadingId, error: idError } = useRestaurantId()

  const fetchTables = useCallback(async (): Promise<TablesResult> => {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from("tables")
      .select(`
        *,
        qr_codes:table_qr_codes (
          id,
          qr_code,
          qr_active,
          created_at
        )
      `, { count: "exact" })
      .eq("restaurant_id", restaurantId)
      .order("table_number", { ascending: true })
      .range(from, to)

    if (error) throw error

    return {
      items: data ?? [],
      total: count ?? 0,
    }
  }, [restaurantId, page, pageSize])

  const { data, isLoading, isPendingRetry, error, refresh } = useCache<TablesResult>(
    `tables-${restaurantId ?? "pending"}-p${page}-s${pageSize}`,
    fetchTables,
    {
      enabled: Boolean(restaurantId),
      revalidateOnMount: true,
      ttl: 10 * 60 * 1000,
    }
  )

  if (error) {
    logger.error("Error cargando mesas", error)
  }

  return {
    tables: data?.items ?? [],
    total: data?.total ?? 0,
    loading: loadingId || isLoading || isPendingRetry,
    error: idError || (error ? "Error al cargar mesas" : ""),
    refresh,
  }
}