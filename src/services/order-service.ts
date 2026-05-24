import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  CreateOrderSchema,
  type CreateOrderInput,
} from "@/lib/validation/order"
import { ok, fail, type Result } from "@/services/result"

export type CreatedOrder = {
  id: number
  statusId: number
  statusName: string | null
  createdAt: string
  tableId: number
  restaurantId: number
  total: number
}

export async function createOrder(input: CreateOrderInput): Promise<Result<CreatedOrder>> {
  const validation = CreateOrderSchema.safeParse(input)

  if (!validation.success) {
    return fail(validation.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { tableId, restaurantId, items } = validation.data

  const total = items.reduce(
    (sum, item) => sum + item.productPrice * item.productQuantity,
    0
  )

  const supabase = await createSupabaseServerClient()

  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .insert({
      table_id: tableId,
      restaurant_id: restaurantId,
      total,
      status_id: 1,
    })
    .select("id, status_id, created_at, table_id, restaurant_id, total, order_status(status_name)")
    .single()

  if (orderError || !orderData) {
    return fail("Error al crear el pedido")
  }

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(
      items.map((item) => ({
        order_id: orderData.id,
        product_id: item.productId,
        product_name: item.productName,
        product_price: item.productPrice,
        product_quantity: item.productQuantity,
        notes: item.notes ?? null,
      }))
    )

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", orderData.id)
    return fail("Error al guardar los items del pedido")
  }

  const statusName = Array.isArray(orderData.order_status)
    ? orderData.order_status[0]?.status_name ?? null
    : (orderData.order_status as { status_name: string | null } | null)?.status_name ?? null

  return ok({
    id: orderData.id,
    statusId: orderData.status_id,
    statusName,
    createdAt: orderData.created_at,
    tableId: orderData.table_id,
    restaurantId: orderData.restaurant_id,
    total: orderData.total,
  })
}