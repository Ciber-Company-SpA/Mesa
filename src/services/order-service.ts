import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  CreateOrderSchema,
  type CreateOrderInput,
} from "@/lib/validation/order"
import { ok, fail, type Result } from "@/services/result"
import { requireStaffForRestaurant } from "@/services/auth-guard"

export const ORDER_STATUS_NUEVO = 1
export const ORDER_STATUS_PREPARANDO = 2
export const ORDER_STATUS_LISTO = 3
export const ORDER_STATUS_PAGADO = 4

export type WaiterOrderItem = {
  id: number
  productName: string
  productPrice: number
  productQuantity: number
  notes: string | null
}

export type WaiterOrder = {
  id: number
  readyAt: string | null
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
  ready_at: string | null
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
    readyAt: row.ready_at,
    items: (row.order_items ?? []).map((it) => ({
      id: it.id,
      productName: it.product_name ?? "",
      productPrice: Number(it.product_price ?? 0),
      productQuantity: it.product_quantity,
      notes: it.notes,
    })),
  }
}

/**
 * Lee restaurant_id de una orden. Helper interno para validar permisos
 * cuando la action recibe solo orderId.
 */
async function getRestaurantIdForOrder(orderId: number): Promise<number | null> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("orders")
    .select("restaurant_id")
    .eq("id", orderId)
    .maybeSingle()
  return data?.restaurant_id ?? null
}

/**
 * Lee restaurant_id de una mesa. Helper interno para validar permisos
 * cuando la action recibe solo tableId.
 */
async function getRestaurantIdForTable(tableId: number): Promise<number | null> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("tables")
    .select("restaurant_id")
    .eq("id", tableId)
    .maybeSingle()
  return data?.restaurant_id ?? null
}

// ============ LIST (staff) ============

export async function listActiveOrdersForRestaurant(
  restaurantId: number
): Promise<Result<WaiterOrder[]>> {
  const guard = await requireStaffForRestaurant(restaurantId)
  if (!guard.ok) return fail(guard.error)
  const { supabase } = guard.data

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, table_id, total, status_id, created_at, ready_at, tables(table_number), order_items(id, product_name, product_price, product_quantity, notes)"
    )
    .eq("restaurant_id", restaurantId)
    .in("status_id", [ORDER_STATUS_NUEVO, ORDER_STATUS_PREPARANDO, ORDER_STATUS_LISTO, ORDER_STATUS_PAGADO])
    .order("created_at", { ascending: false })

  if (error) return fail("Error al cargar las órdenes")

  return ok((data ?? []).map((row) => mapOrderRow(row as unknown as OrderRow)))
}

// ============ ADVANCE STATUS (staff) ============

export async function advanceOrderStatus(
  orderId: number
): Promise<Result<{ id: number; statusId: number }>> {
  if (!orderId || orderId <= 0) return fail("Orden inválida")

  const restaurantId = await getRestaurantIdForOrder(orderId)
  if (!restaurantId) return fail("Orden no encontrada")

  const guard = await requireStaffForRestaurant(restaurantId)
  if (!guard.ok) return fail(guard.error)
  const { supabase } = guard.data

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

// ============ MARK PAID (staff) ============

// Marca un pedido como Pagado. Si todos los pedidos activos de la mesa
// quedan en estado Pagado, libera la mesa (current_waiter_id = null) para
// que otro mesero pueda reclamarla escaneando el QR.
export async function markOrderAsPaid(
  orderId: number
): Promise<Result<{ id: number; statusId: number; tableReleased: boolean }>> {
  if (!orderId || orderId <= 0) return fail("Orden inválida")

  const restaurantId = await getRestaurantIdForOrder(orderId)
  if (!restaurantId) return fail("Orden no encontrada")

  const guard = await requireStaffForRestaurant(restaurantId)
  if (!guard.ok) return fail(guard.error)
  const { supabase } = guard.data

  const { data: current, error: readError } = await supabase
    .from("orders")
    .select("id, status_id, table_id")
    .eq("id", orderId)
    .maybeSingle()

  if (readError) return fail("Error al leer la orden")
  if (!current) return fail("Orden no encontrada")
  if (current.status_id === ORDER_STATUS_PAGADO) {
    return fail("La orden ya está pagada")
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status_id: ORDER_STATUS_PAGADO })
    .eq("id", orderId)

  if (updateError) return fail("Error al marcar la orden como pagada")

  let tableReleased = false
  if (current.table_id) {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("table_id", current.table_id)
      .in("status_id", [ORDER_STATUS_NUEVO, ORDER_STATUS_PREPARANDO, ORDER_STATUS_LISTO])

    if ((count ?? 0) === 0) {
      const { error: releaseError } = await supabase
        .from("tables")
        .update({ current_waiter_id: null })
        .eq("id", current.table_id)

      if (!releaseError) tableReleased = true
    }
  }

  return ok({ id: orderId, statusId: ORDER_STATUS_PAGADO, tableReleased })
}

// ============ MARK TABLE PAID (staff) ============

// Marca como pagados TODOS los pedidos activos (Nuevo/Preparando/Listo) de una
// mesa en una sola operación. Libera la mesa (current_waiter_id = null) si
// queda sin pedidos activos.
export async function markTableOrdersAsPaid(
  tableId: number
): Promise<Result<{ tableId: number; paidIds: number[]; tableReleased: boolean }>> {
  if (!tableId || tableId <= 0) return fail("Mesa inválida")

  const restaurantId = await getRestaurantIdForTable(tableId)
  if (!restaurantId) return fail("Mesa no encontrada")

  const guard = await requireStaffForRestaurant(restaurantId)
  if (!guard.ok) return fail(guard.error)
  const { supabase } = guard.data

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status_id: ORDER_STATUS_PAGADO })
    .eq("table_id", tableId)
    .in("status_id", [ORDER_STATUS_NUEVO, ORDER_STATUS_PREPARANDO, ORDER_STATUS_LISTO])
    .select("id")

  if (updateError) return fail("Error al marcar las órdenes como pagadas")

  const paidIds = (updated ?? []).map((row) => row.id)

  let tableReleased = false
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("table_id", tableId)
    .in("status_id", [ORDER_STATUS_NUEVO, ORDER_STATUS_PREPARANDO, ORDER_STATUS_LISTO])

  if ((count ?? 0) === 0) {
    const { error: releaseError } = await supabase
      .from("tables")
      .update({ current_waiter_id: null })
      .eq("id", tableId)

    if (!releaseError) tableReleased = true
  }

  return ok({ tableId, paidIds, tableReleased })
}

// ============ CREATE ORDER (PÚBLICO — cliente escanea QR) ============

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
  // NOTA: NO requiere auth — esta acción la dispara el CLIENTE del menú
  // (escaneando un QR). La protección está en validar que la mesa existe
  // y que los productos pertenecen al mismo restaurante.

  const validation = CreateOrderSchema.safeParse(input)

  if (!validation.success) {
    return fail(validation.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { tableId, items } = validation.data

  const supabase = await createSupabaseServerClient()

  // 1. Resolver el restaurante real desde la mesa (no confiamos en el cliente)
  const { data: table, error: tableError } = await supabase
    .from("tables")
    .select("id, restaurant_id")
    .eq("id", tableId)
    .maybeSingle()

  if (tableError || !table || !table.restaurant_id) {
    return fail("Mesa no encontrada")
  }

  const restaurantId = table.restaurant_id

  // 2. Cargar configuración del restaurante para decidir el status inicial.
  // Si order_destination = 'kitchen' los pedidos arrancan en "En preparación"
  // (status_id=2), saltando al mesero. Caso contrario inician en "Nuevo".
  const { data: restaurantRow } = await supabase
    .from("restaurants")
    .select("order_destination")
    .eq("id", restaurantId)
    .maybeSingle()

  const initialStatusId = restaurantRow?.order_destination === "kitchen" ? 2 : 1

  const productIds = items.map((i) => i.productId)
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, product_name, product_price, restaurant_id, status_id")
    .in("id", productIds)
    .eq("restaurant_id", restaurantId)

  if (productsError) {
    return fail("Error al verificar los productos")
  }

  // 3. Validar que TODOS los productos existen y son del mismo restaurante
  if (!products || products.length !== productIds.length) {
    return fail("Uno o más productos no pertenecen a este restaurante")
  }

  // 4. Validar que todos están activos
  const inactiveProduct = products.find((p) => p.status_id !== 1)
  if (inactiveProduct) {
    return fail(`El producto "${inactiveProduct.product_name}" no está disponible`)
  }

  // 5. Construir items con datos REALES de la DB
  const productMap = new Map(products.map((p) => [p.id, p]))
  const serverItems = items.map((clientItem) => {
    const product = productMap.get(clientItem.productId)!
    return {
      productId: product.id,
      productName: product.product_name ?? "",
      productPrice: Number(product.product_price ?? 0),
      productQuantity: clientItem.productQuantity,
      notes: clientItem.notes ?? null,
    }
  })

  // 6. Calcular total con precios reales
  const total = serverItems.reduce(
    (sum, item) => sum + item.productPrice * item.productQuantity,
    0
  )

  // 7. Crear la orden con datos del servidor
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .insert({
      table_id: tableId,
      restaurant_id: restaurantId,
      total,
      status_id: initialStatusId,
      created_at: new Date().toISOString(),
    })
    .select("id, status_id, created_at, table_id, restaurant_id, total, order_status(status_name)")
    .single()

  if (orderError || !orderData) {
    return fail("Error al crear el pedido")
  }

  // 8. Insertar items con datos REALES
  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(
      serverItems.map((item) => ({
        order_id: orderData.id,
        product_id: item.productId,
        product_name: item.productName,
        product_price: item.productPrice,
        product_quantity: item.productQuantity,
        notes: item.notes,
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