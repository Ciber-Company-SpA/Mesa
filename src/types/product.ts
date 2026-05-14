import type { Category } from "@/types/category"
import type { ProductStatus } from "@/types/product-status"
import type { ProductVariant } from "@/types/product-variant"

export type Product = {
  id: number
  product_name: string
  product_description: string | null
  product_image: string | null
  product_image_public_id: string | null
  product_price: number
  category_id: number
  restaurant_id: number
  status_id: number
  categories: Category
  product_status?: ProductStatus
  product_variants?: ProductVariant[]
}
