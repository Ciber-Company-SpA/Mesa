import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import type { ProductVariant } from "@/types/product-variant"

export function useProductVariants(productId: number | null) {
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!productId) return

    async function loadVariants() {
      try {
        setLoading(true)
        setError("")

        const { data, error } = await supabase
          .from("product_variants")
          .select("*")
          .eq("product_id", productId)
          .order("created_at", { ascending: true })

        if (error) throw error

        setVariants(data || [])
      } catch (err) {
        logger.error("Error cargando variantes", err)
        setError(err instanceof Error ? err.message : "Error desconocido")
      } finally {
        setLoading(false)
      }
    }

    loadVariants()
  }, [productId])

  return { variants, loading, error }
}