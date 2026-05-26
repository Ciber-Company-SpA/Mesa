export type CartItem = {
  id: string
  productId: number
  variantId: number | null
  name: string
  price: number
  quantity: number
  image?: string
  notes?: string | null
  addedBy?: string | null
}
