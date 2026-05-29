import { useCallback, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import type { MenuData } from "@/types/menu"
import { Category } from "@/types/category"
import { useCache, writeCache } from "@/hooks/useCache"

const EMPTY_MENU: MenuData = {
  restaurant: null,
  categories: [],
  products: [],
  tableId: null,
  tableNumber: null,
}

export function useMenuData(qrCode: string) {
  const fetcher = useCallback(async (): Promise<MenuData> => {
    // 1. Obtener id del QR
    const { data: qrData, error: qrError } = await supabase
      .from("table_qr_codes")
      .select("id")
      .eq("qr_code", qrCode)
      .single()

    if (qrError || !qrData) throw new Error("QR no válido")

    // 2. Obtener mesa con ese qr_code_id
    const { data: tableData, error: tableError } = await supabase
      .from("tables")
      .select("id, table_number, restaurant_id")
      .eq("qr_code_id", qrData.id)
      .single()

    if (tableError || !tableData) throw new Error("Mesa no encontrada")

    const { restaurant_id, table_number } = tableData

    // 3. Restaurante, productos y categorías en paralelo
    const [restaurantRes, productsRes, categoriesRes] = await Promise.all([
      supabase
        .from("restaurants")
        .select("id, restaurant_name, restaurant_logo, menu_header_type, menu_header_color_1, menu_header_color_2")
        .eq("id", restaurant_id)
        .single(),
      supabase
        .from("products")
        .select(`*, categories ( category_name ), product_variants (*)`)
        .eq("restaurant_id", restaurant_id),
      supabase
        .from("categories")
        .select("id, category_name")
        .eq("restaurant_id", restaurant_id),
    ])

    if (restaurantRes.error) throw restaurantRes.error
    if (productsRes.error) throw productsRes.error
    if (categoriesRes.error) throw categoriesRes.error

    return {
      restaurant: restaurantRes.data,
      products: productsRes.data ?? [],
      categories: (categoriesRes.data ?? []) as Category[],
      tableId: tableData.id,
      tableNumber: table_number,
    }
  }, [qrCode])

  const {
    data,
    isFromCache,
    isLoading,
    isPendingRetry,
    error: cacheError,
    refresh,
    cancel,
  } = useCache<MenuData>(
    `menu-${qrCode}`,    // clave única por QR
    fetcher,
    { ttl: 1000 * 60 * 60 } // cache válido 1 hora
  )

  if (cacheError) {
    logger.error("Error cargando menú", cacheError)
  }

  useEffect(() => {
    if (!data) return

    data.products.forEach((product) => {
      writeCache(`product-${product.id}`, product)

      if (Array.isArray(product.product_variants)) {
        writeCache(`product-variants-${product.id}`, product.product_variants)
      }
    })
  }, [data])

  return {
    ...(data ?? EMPTY_MENU),
    loading: isLoading,
    error: cacheError ? "No se pudo cargar el menú" : "",
    isFromCache,    // true → mostrar banner "modo offline"
    isPendingRetry, // true → mostrar spinner de reintentando...
    refresh,
    cancel,
  }
}
