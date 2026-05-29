import { unstable_cache } from "next/cache"
import { createSupabaseAnonClient } from "@/lib/supabase/anon"
import type { MenuData } from "@/types/menu"
import type { Category } from "@/types/category"

async function fetchMenuData(qrCode: string): Promise<MenuData> {
  const supabase = createSupabaseAnonClient()

  const { data: qrData, error: qrError } = await supabase
    .from("table_qr_codes")
    .select("id")
    .eq("qr_code", qrCode)
    .single()

  if (qrError || !qrData) throw new Error("QR no válido")

  const { data: tableData, error: tableError } = await supabase
    .from("tables")
    .select("id, table_number, restaurant_id")
    .eq("qr_code_id", qrData.id)
    .single()

  if (tableError || !tableData) throw new Error("Mesa no encontrada")

  const { restaurant_id, table_number } = tableData

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
}

export const getMenuData = unstable_cache(
  fetchMenuData,
  ["menu-data"], // key base, el qrCode se agrega automáticamente como argumento
  {
    revalidate: 300, // 5 minutos
    tags: ["menu"], // tag para invalidación manual con revalidateTag("menu")
  }
)