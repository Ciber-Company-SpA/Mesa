import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useCache } from "@/hooks/useCache"
import type { Product } from "@/types/product"

export function useProducts() {
  const { restaurantId, loading: loadingId, error: idError } = useRestaurantId()

  const fetchProducts = useCallback(async (): Promise<Product[]> => {
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        categories (
          category_name
        ),
        product_status (
          id,
          status_name
        )
      `)
      .eq("restaurant_id", restaurantId)

    if (error) throw error

    return data || []
  }, [restaurantId])

  const { data, isLoading, isPendingRetry, error } = useCache<Product[]>(
  `products-${restaurantId ?? "pending"}`,
  fetchProducts,
  {
    enabled: Boolean(restaurantId),
    revalidateOnMount: true,
    ttl: 5 * 60 * 1000, // 5 minutos
  }
)

  if (error) {
    logger.error("Error cargando productos", error)
  }

  return {
    products: data ?? [],
    loading: loadingId || isLoading || isPendingRetry,
    error: idError || (error ? "Error al cargar productos" : "")
  }
}
