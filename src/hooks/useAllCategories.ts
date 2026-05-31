import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useCache } from "@/hooks/useCache"
import type { Category } from "@/types/category"


export function useAllCategories() {
  const { restaurantId, loading: loadingId, error: idError } = useRestaurantId()

  const fetchAllCategories = useCallback(async (): Promise<Category[]> => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("category_name", { ascending: true })
      .limit(200)

    if (error) throw error

    return (data ?? []) as Category[]
  }, [restaurantId])

  const { data, isLoading, isPendingRetry, error } = useCache<Category[]>(
    `categories-all-${restaurantId ?? "pending"}`,
    fetchAllCategories,
    {
      enabled: Boolean(restaurantId),
      revalidateOnMount: true,
      ttl: 10 * 60 * 1000,
    }
  )

  if (error) {
    logger.error("Error cargando todas las categorias", error)
  }

  return {
    categories: data ?? [],
    loading: loadingId || isLoading || isPendingRetry,
    error: idError || (error ? "Error al cargar categorias" : ""),
  }
}