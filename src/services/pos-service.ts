"use server"

// TOMA DE PEDIDOS por el STAFF (POS): el admin (en Productos) y el mesero
// (en su panel) toman pedidos con LA MISMA carta del menú QR y por el MISMO
// circuito del comensal — cero lógica duplicada:
//
//  · Menú: getMenuData(qr_token) — el mismo payload cacheado (tag "menu") que
//    ve el comensal; cualquier cambio en Productos se refleja en ambos.
//  · Creación: createOrder() → RPC create_public_order_qr (precios SIEMPRE
//    server-side, promos build revalidadas, cupones, stock por receta).
//  · La credencial es el qr_token de la mesa, que el staff puede leer de SU
//    restaurante por RLS (tables + table_qr_codes, tenant-scoped).
//
// El pedido creado entra al flujo normal: cocina/mesero lo ven en realtime y
// se cobra desde la sección Cobrar (admin) o la app del mesero.

import { requireCurrentStaff, WAITER_ROLE_ID } from "@/services/auth-guard"
import { getMenuData } from "@/lib/menu/get-menu-data"
import { createOrder, type CreatedOrder } from "@/services/order-service"
import type { CreateOrderItemInput } from "@/lib/validation/order"
import { ok, fail, type Result } from "@/services/result"
import type { MenuData } from "@/types/menu"

export type PosTable = {
  id: number
  tableNumber: number | null
  /** Mesa con mesero asignado (ocupada). El staff igual puede pedir en ella. */
  claimed: boolean
}

export type PosData = {
  tables: PosTable[]
  menu: Pick<MenuData, "categories" | "products" | "promotions">
}

type TableRow = {
  id: number
  table_number: number | null
  current_waiter_id: number | null
  table_qr_codes: { qr_code: string; qr_active: boolean } | null
}

/** Mesas del restaurante + carta (la misma del menú QR, mismo cache). */
export async function getPosData(): Promise<Result<PosData>> {
  const auth = await requireCurrentStaff()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data

  const { data, error } = await supabase
    .from("tables")
    .select("id, table_number, current_waiter_id, table_qr_codes(qr_code, qr_active)")
    .order("table_number", { ascending: true })
  if (error) return fail("No se pudieron cargar las mesas")

  const rows = (data ?? []) as unknown as TableRow[]
  const active = rows.filter((t) => t.table_qr_codes?.qr_active && t.table_qr_codes.qr_code)
  if (active.length === 0) {
    return fail("No hay mesas con QR activo. Crea mesas en el módulo Mesas primero.")
  }

  let menu: MenuData
  try {
    menu = await getMenuData(active[0].table_qr_codes!.qr_code)
  } catch {
    return fail("No se pudo cargar la carta")
  }

  return ok({
    tables: active.map((t) => ({
      id: t.id,
      tableNumber: t.table_number,
      claimed: t.current_waiter_id != null,
    })),
    menu: {
      categories: menu.categories,
      products: menu.products,
      promotions: menu.promotions,
    },
  })
}

export type PosOrderResult = CreatedOrder & { tableNumber: number | null }

/**
 * Crea el pedido para una mesa por el circuito del comensal. Si quien pide es
 * un MESERO y la mesa está libre, la reclama para él (aparece en su panel).
 */
export async function createPosOrder(
  tableId: number,
  items: CreateOrderItemInput[]
): Promise<Result<PosOrderResult>> {
  const auth = await requireCurrentStaff()
  if (!auth.ok) return fail(auth.error)
  const { supabase, roleId, userId } = auth.data

  const { data: table, error } = await supabase
    .from("tables")
    .select("id, table_number, current_waiter_id, table_qr_codes(qr_code, qr_active)")
    .eq("id", tableId)
    .maybeSingle()
  if (error || !table) return fail("Mesa no encontrada")

  const row = table as unknown as TableRow
  const qrToken = row.table_qr_codes?.qr_active ? row.table_qr_codes.qr_code : null
  if (!qrToken) return fail("La mesa no tiene QR activo")

  const created = await createOrder({ qrToken, items })
  if (!created.ok) return fail(created.error)

  // Mesero en mesa libre → reclamarla (best-effort; el pedido ya existe).
  if (roleId === WAITER_ROLE_ID && row.current_waiter_id == null) {
    const { data: me } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle()
    if (me?.id) {
      await supabase.rpc("reassign_table", {
        p_table_id: tableId,
        p_new_waiter_id: me.id,
      })
    }
  }

  return ok({ ...created.data, tableNumber: row.table_number })
}
