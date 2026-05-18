import type { OrderStatus } from "@/types/order-status"

export type Order = {
  id: number
  table_id: number
  total: number
  status_id: number
  created_at: string
  order_status: OrderStatus | null
  tables: { table_number: number }[]
  order_qr_codes: { qr_code: string; qr_active: boolean } | null
}