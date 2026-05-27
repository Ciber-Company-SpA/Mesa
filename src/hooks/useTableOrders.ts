import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"

export type TableOrderItem = {
  id: number
  productName: string
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
  items: TableOrderItem[]
}

type OrderRow = {
  id: number
  total: number
  status_id: number | null
  created_at: string
  order_status: { status_name: string | null } | { status_name: string | null }[] | null
  order_items: Array<{
    id: number
    product_name: string | null
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
    items: (row.order_items ?? []).map((it) => ({
      id: it.id,
      productName: it.product_name ?? "",
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
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, status_id, created_at, order_status(status_name), order_items(id, product_name, product_price, product_quantity, notes)")
        .eq("table_id", tableId)
        .order("created_at", { ascending: false })

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
