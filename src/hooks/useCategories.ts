import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useCache } from "@/hooks/useCache"
import type { Category } from "@/types/category"

type UseCategoriesOptions = {
  page?: number
  pageSize?: number
}

type CategoriesResult = {
  items: Category[]
  total: number
}

export function useCategories({ page = 1, pageSize = 12 }: UseCategoriesOptions = {}) {
  const { restaurantId, loading: loadingId, error: idError } = useRestaurantId()

  const fetchCategories = useCallback(async (): Promise<CategoriesResult> => {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from("categories")
      .select("*", { count: "exact" })
      .eq("restaurant_id", restaurantId)
      .order("id", { ascending: false })
      .range(from, to)

    if (error) throw error

    return {
      items: (data ?? []) as Category[],
      total: count ?? 0,
    }
  }, [restaurantId, page, pageSize])

  const { data, isLoading, isPendingRetry, error, refresh } = useCache<CategoriesResult>(
    `categories-${restaurantId ?? "pending"}-p${page}-s${pageSize}`,
    fetchCategories,
    {
      enabled: Boolean(restaurantId),
      revalidateOnMount: true,
      ttl: 10 * 60 * 1000,
    }
  )

  if (error) {
    logger.error("Error cargando categorias", error)
  }

  return {
    categories: data?.items ?? [],
    total: data?.total ?? 0,
    loading: loadingId || isLoading || isPendingRetry,
    error: idError || (error ? "Error al cargar categorias" : ""),
    refresh,
  }
}