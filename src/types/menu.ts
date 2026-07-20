import type { PublicRestaurant } from "@/types/restaurant"
import type { Product } from "@/types/product"
import type { Category } from "@/types/category"

// Promoción (combo) tal como la ve el comensal en el menú.
export interface MenuPromotion {
  id: number
  name: string
  description: string | null
  promo_price: number
  image_url: string | null
  original_total: number
  items: { product_name: string; variant_name: string | null; quantity: number }[]
}

export interface MenuData {
  restaurant: PublicRestaurant | null
  categories: Category[]
  products: Product[]
  promotions: MenuPromotion[]
  tableId: number | null
  tableNumber: number | null
  // Reserva activa de la mesa (hint inicial desde SSR; el cliente la reconfirma
  // en vivo con check_table_reservation porque este payload está cacheado 5 min).
  reservation: { ends_at: string } | null
}
