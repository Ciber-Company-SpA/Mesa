import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import type { Product } from "@/types/product"

export function useProducts() {
  const { restaurantId, loading: loadingId, error: idError } = useRestaurantId()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!restaurantId) return

    async function loadProducts() {
      try {
        setLoading(true)
        setError("")

        const { data, error } = await supabase
          .from("products")
          .select(`
            *,
            categories (
              category_name
            )
          `)
          .eq("restaurant_id", restaurantId)

        if (error) throw error

        setProducts(data || [])
      } catch (err) {
        logger.error("Error cargando productos", err)
        setError(err instanceof Error ? err.message : "Error desconocido")
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [restaurantId])

  return {
    products,
    loading: loadingId || loading,
    error: idError || error
  }
}