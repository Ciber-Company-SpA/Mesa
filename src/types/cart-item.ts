export type CartItem = {
  id: string
  // productId es null cuando la línea es una promoción (combo).
  productId: number | null
  variantId: number | null
  // promotionId no es null cuando la línea es una promoción.
  promotionId?: number | null
  name: string
  price: number
  quantity: number
  image?: string
  notes?: string | null
  addedBy?: string | null
}
