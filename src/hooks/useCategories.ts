import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"
import type { Category } from "@/types/category"

export function useCategories() {
  const { restaurantId, loading: loadingId, error: idError } = useRestaurantId()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { run: loadCategoriesWithRetry, isPending } = useOfflineRetry(async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId)

    if (error) throw error

    setCategories(data || [])
    setError("")
  })

  useEffect(() => {
    if (!restaurantId) return

    async function loadCategories() {
      try {
        setLoading(true)
        setError("")

        await loadCategoriesWithRetry()
      } catch (err: unknown) {
        if (isNetworkError(err)) return
        logger.error("Error cargando categorías", err)
        setError("Error al cargar categorías")
      } finally {
        setLoading(false)
      }
    }

    loadCategories()
  }, [loadCategoriesWithRetry, restaurantId])

  return {
    categories,
    loading: loadingId || loading || isPending,
    error: idError || error
  }
}
