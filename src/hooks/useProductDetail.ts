import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useCache } from "@/hooks/useCache"
import type { Product } from "@/types/product"

export function useProductDetail(productId: number | null) {
  const fetchProduct = useCallback(async (): Promise<Product> => {
    const { data, error } = await supabase
      .from("products")
      .select(`*, categories ( category_name )`)
      .eq("id", productId)
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error("Producto no encontrado")

    return data
  }, [productId])

  const { data, isLoading, isPendingRetry, error } = useCache<Product>(
    `product-${productId ?? "pending"}`,
    fetchProduct,
    { enabled: Boolean(productId) }
  )

  if (error) {
    logger.error("Error cargando producto", error)
  }

  return {
    product: data,
    loading: isLoading || isPendingRetry,
    error: error instanceof Error ? error.message : error ? "Error desconocido" : ""
  }
}
