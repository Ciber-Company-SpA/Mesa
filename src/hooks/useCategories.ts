import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import type { Category } from "@/types/category"

export function useCategories() {
  const { restaurantId, loading: loadingId, error: idError } = useRestaurantId()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!restaurantId) return

    async function loadCategories() {
      try {
        setLoading(true)
        setError("")

        const { data, error } = await supabase
          .from("categories")
          .select("*")
          .eq("restaurant_id", restaurantId)

        if (error) throw error

        setCategories(data || [])
      } catch (err: unknown) {
        logger.error("Error cargando categorías", err)
        setError("Error al cargar categorías")
      } finally {
        setLoading(false)
      }
    }

    loadCategories()
  }, [restaurantId])

  return {
    categories,
    loading: loadingId || loading,
    error: idError || error
  }
}
