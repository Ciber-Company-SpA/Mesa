import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useCache } from "@/hooks/useCache"
import type { Category } from "@/types/category"

export function useCategories() {
  const { restaurantId, loading: loadingId, error: idError } = useRestaurantId()

  const fetchCategories = useCallback(async (): Promise<Category[]> => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId)

    if (error) throw error

    return data || []
  }, [restaurantId])

  const { data, isLoading, isPendingRetry, error } = useCache<Category[]>(
    `categories-${restaurantId ?? "pending"}`,
    fetchCategories,
    { enabled: Boolean(restaurantId) }
  )

  if (error) {
    logger.error("Error cargando categorias", error)
  }

  return {
    categories: data ?? [],
    loading: loadingId || isLoading || isPendingRetry,
    error: idError || (error ? "Error al cargar categorias" : "")
  }
}
