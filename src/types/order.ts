import type { OrderStatus } from "@/types/order-status"

export type Order = {
  id: number
  // Correlativo por restaurante (Pedido #1, #2...). Null en pedidos sin restaurant_id.
  order_number: number | null
  table_id: number
  total: number
  status_id: number
  created_at: string
  order_status: OrderStatus | null
  tables: { table_number: number }[]
}
