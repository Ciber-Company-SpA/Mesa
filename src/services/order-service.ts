import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  CreateOrderSchema,
  type CreateOrderInput,
} from "@/lib/validation/order"
import { ok, fail, type Result } from "@/services/result"

export const ORDER_STATUS_NUEVO = 1
export const ORDER_STATUS_PREPARANDO = 2
export const ORDER_STATUS_LISTO = 3

export type WaiterOrderItem = {
  id: number
  productName: string
  productPrice: number
  productQuantity: number
  notes: string | null
}

export type WaiterOrder = {
  id: number
  tableId: number | null
  tableNumber: number | null
  total: number
  statusId: number
  createdAt: string | null
  items: WaiterOrderItem[]
}

type OrderRow = {
  id: number
  table_id: number | null
  total: number | null
  status_id: number | null
  created_at: string | null
  tables: { table_number: number | null } | null
  order_items: Array<{
    id: number
    product_name: string | null
    product_price: number | null
    product_quantity: number
    notes: string | null
  }> | null
}

function mapOrderRow(row: OrderRow): WaiterOrder {
  return {
    id: row.id,
    tableId: row.table_id,
    tableNumber: row.tables?.table_number ?? null,
    total: row.total ?? 0,
    statusId: row.status_id ?? ORDER_STATUS_NUEVO,
    createdAt: row.created_at,
    items: (row.order_items ?? []).map((it) => ({
      id: it.id,
      productName: it.product_name ?? "",
      productPrice: Number(it.product_price ?? 0),
      productQuantity: it.product_quantity,
      notes: it.notes,
    })),
  }
}

export async function listActiveOrdersForRestaurant(
  restaurantId: number
): Promise<Result<WaiterOrder[]>> {
  if (!restaurantId || restaurantId <= 0) {
    return fail("Restaurante inválido")
  }

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, table_id, total, status_id, created_at, tables(table_number), order_items(id, product_name, product_price, product_quantity, notes)"
    )
    .eq("restaurant_id", restaurantId)
    .in("status_id", [ORDER_STATUS_NUEVO, ORDER_STATUS_PREPARANDO, ORDER_STATUS_LISTO])
    .order("created_at", { ascending: false })

  if (error) return fail("Error al cargar las órdenes")

  return ok((data ?? []).map((row) => mapOrderRow(row as unknown as OrderRow)))
}

export async function advanceOrderStatus(
  orderId: number
): Promise<Result<{ id: number; statusId: number }>> {
  if (!orderId || orderId <= 0) return fail("Orden inválida")

  const supabase = await createSupabaseServerClient()

  const { data: current, error: readError } = await supabase
    .from("orders")
    .select("id, status_id")
    .eq("id", orderId)
    .maybeSingle()

  if (readError) return fail("Error al leer la orden")
  if (!current) return fail("Orden no encontrada")

  const currentStatus = current.status_id ?? ORDER_STATUS_NUEVO
  if (currentStatus >= ORDER_STATUS_LISTO) {
    return fail("La orden ya está lista")
  }

  const nextStatus = currentStatus + 1

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status_id: nextStatus })
    .eq("id", orderId)
    .select("id, status_id")

  if (updateError) return fail("Error al avanzar la orden")
  if (!updated || updated.length === 0) {
    return fail("No tienes permisos para actualizar esta orden (RLS)")
  }

  return ok({ id: orderId, statusId: nextStatus })
}

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