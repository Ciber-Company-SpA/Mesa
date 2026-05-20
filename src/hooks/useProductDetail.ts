import { useCallback, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useCache, writeCache } from "@/hooks/useCache"
import type { Product } from "@/types/product"

export function useProductDetail(productId: number | null, fallbackProduct?: Product | null) {
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

  useEffect(() => {
    if (!fallbackProduct) return

    writeCache(`product-${fallbackProduct.id}`, fallbackProduct)
  }, [fallbackProduct])

  const product = data ?? fallbackProduct ?? null

  if (error && !fallbackProduct) {
    logger.error("Error cargando producto", error)
  }

  return {
    product,
    loading: !product && (isLoading || isPendingRetry),
    error: product ? "" : error instanceof Error ? error.message : error ? "Error desconocido" : ""
  }
}
