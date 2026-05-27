import { useCallback, useEffect, useId } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useCache } from "@/hooks/useCache"
import type { Product } from "@/types/product"

type UseProductsOptions = {
  page?: number
  pageSize?: number
}

type ProductsResult = {
  items: Product[]
  total: number
}

export function useProducts({ page = 1, pageSize = 12 }: UseProductsOptions = {}) {
  const { restaurantId, loading: loadingId, error: idError } = useRestaurantId()
  const instanceId = useId()

  const fetchProducts = useCallback(async (): Promise<ProductsResult> => {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
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
      `, { count: "exact" })
      .eq("restaurant_id", restaurantId)
      .order("id", { ascending: false })
      .range(from, to)

    if (error) throw error

    return {
      items: data ?? [],
      total: count ?? 0,
    }
  }, [restaurantId, page, pageSize])

  const { data, isLoading, isPendingRetry, error, refresh } = useCache<ProductsResult>(
    `products-${restaurantId ?? "pending"}-p${page}-s${pageSize}`,
    fetchProducts,
    {
      enabled: Boolean(restaurantId),
      revalidateOnMount: true,
      ttl: 5 * 60 * 1000,
    }
  )

  if (error) {
    logger.error("Error cargando productos", error)
  }

  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel(`products-list-${restaurantId}-p${page}-s${pageSize}-${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => refresh()
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logger.warn(`Realtime products-list channel: ${status}`)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, page, pageSize, refresh, instanceId])

  return {
    products: data?.items ?? [],
    total: data?.total ?? 0,
    loading: loadingId || isLoading || isPendingRetry,
    error: idError || (error ? "Error al cargar productos" : ""),
    refresh,
  }
}