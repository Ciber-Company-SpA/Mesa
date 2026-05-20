import { useCallback, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useCache, writeCache } from "@/hooks/useCache"
import type { ProductVariant } from "@/types/product-variant"

export function useProductVariants(
  productId: number | null,
  fallbackVariants?: ProductVariant[]
) {
  const fetchVariants = useCallback(async (): Promise<ProductVariant[]> => {
    const { data, error } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: true })

    if (error) throw error

    return data || []
  }, [productId])

  const { data, isLoading, isPendingRetry, error } = useCache<ProductVariant[]>(
    `product-variants-${productId ?? "pending"}`,
    fetchVariants,
    { enabled: Boolean(productId) }
  )

  useEffect(() => {
    if (!productId || !fallbackVariants) return

    writeCache(`product-variants-${productId}`, fallbackVariants)
  }, [fallbackVariants, productId])

  const hasFallback = fallbackVariants !== undefined
  const variants = data ?? fallbackVariants ?? []

  if (error && !hasFallback) {
    logger.error("Error cargando variantes", error)
  }

  return {
    variants,
    loading: !hasFallback && variants.length === 0 && (isLoading || isPendingRetry),
    error: hasFallback ? "" : error instanceof Error ? error.message : error ? "Error desconocido" : ""
  }
}
