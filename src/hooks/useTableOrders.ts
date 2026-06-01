import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"

export type TableOrderItem = {
  id: number
  productName: string
  variantName: string | null
  productPrice: number
  productQuantity: number
  notes: string | null
}

export type TableOrder = {
  id: number
  total: number
  statusId: number | null
  statusName: string | null
  createdAt: string
  readyAt: string | null
  items: TableOrderItem[]
}

type OrderRow = {
  id: number
  total: number
  status_id: number | null
  created_at: string
  ready_at: string | null
  order_status: { status_name: string | null } | { status_name: string | null }[] | null
  order_items: Array<{
    id: number
    product_name: string | null
    variant_name: string | null
    product_price: number | null
    product_quantity: number
    notes: string | null
  }> | null
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

const TERMINAL_STATUS_NAMES = new Set(["pagado", "pagada"])

function isOrderActive(statusName: string | null) {
  if (!statusName) return true
  return !TERMINAL_STATUS_NAMES.has(normalize(statusName))
}

function pickStatusName(orderStatus: OrderRow["order_status"]) {
  if (!orderStatus) return null
  if (Array.isArray(orderStatus)) return orderStatus[0]?.status_name ?? null
  return orderStatus.status_name ?? null
}

function mapRow(row: OrderRow): TableOrder {
  return {
    id: row.id,
    total: row.total,
    statusId: row.status_id,
    statusName: pickStatusName(row.order_status),
    createdAt: row.created_at,
    readyAt: row.ready_at,
    items: (row.order_items ?? []).map((it) => ({
      id: it.id,
      productName: it.product_name ?? "",
      variantName: it.variant_name,
      productPrice: Number(it.product_price ?? 0),
      productQuantity: it.product_quantity,
      notes: it.notes,
    })),
  }
}

export function useTableOrders(tableId: number | null) {
  const [orders, setOrders] = useState<TableOrder[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchOrders = useCallback(async () => {
    if (!tableId) {
      setOrders([])
      return
    }

    setIsLoading(true)
    try {
      // RPC SECURITY DEFINER: el cliente público (anon) no tiene SELECT directo
      // sobre orders/order_items; esta función solo devuelve los pedidos de la
      // mesa que pasa como parámetro.
      const { data, error } = await supabase.rpc("get_orders_for_table", {
        p_table_id: tableId,
      })

      if (error) throw error

      const rows = (data ?? []) as unknown as OrderRow[]
      const active = rows.map(mapRow).filter((o) => isOrderActive(o.statusName))
      setOrders(active)
    } catch (err) {
      logger.error("Error cargando pedidos de la mesa", err)
    } finally {
      setIsLoading(false)
    }
  }, [tableId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de pedidos al montar
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    if (!tableId) return

    const channel = supabase
      .channel(`table-orders-${tableId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `table_id=eq.${tableId}`,
        },
        () => fetchOrders()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tableId, fetchOrders])

  return { orders, isLoading, refresh: fetchOrders }
}
