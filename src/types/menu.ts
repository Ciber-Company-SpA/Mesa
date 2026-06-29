import type { PublicRestaurant } from "@/types/restaurant"
import type { Product } from "@/types/product"
import type { Category } from "@/types/category"


export interface MenuData {
  restaurant: PublicRestaurant | null
  categories: Category[]
  products: Product[]
  tableId: number | null
  tableNumber: number | null
  // Reserva activa de la mesa (hint inicial desde SSR; el cliente la reconfirma
  // en vivo con check_table_reservation porque este payload está cacheado 5 min).
  reservation: { ends_at: string } | null
}
