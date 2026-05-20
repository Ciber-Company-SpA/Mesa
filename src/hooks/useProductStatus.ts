import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useCache } from "@/hooks/useCache"
import type { ProductStatus } from "@/types/product-status"

export function useProductStatus() {
  const fetchStatuses = useCallback(async (): Promise<ProductStatus[]> => {
    const { data, error } = await supabase
      .from("product_status")
      .select("*")

    if (error) throw error

    return (data || []).map((status) => ({
      ...status,
      status_name: status.status_name ?? status.nombre ?? "",
    }))
  }, [])

  const { data, isLoading, isPendingRetry, error } = useCache<ProductStatus[]>(
    "product-status",
    fetchStatuses
  )

  if (error) {
    logger.error("Error cargando estados de producto", error)
  }

  return {
    statuses: data ?? [],
    loading: isLoading || isPendingRetry,
    error: error ? "Error al cargar estados de producto" : ""
  }
}
