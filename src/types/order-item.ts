export type OrderItem = {
  id: number
  order_id: number
  product_id: number | null
  product_name: string
  product_price: number
  product_quantity: number
  notes: string | null
  created_at: string
}