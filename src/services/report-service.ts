"use server"

import { z } from "zod"
import { requireCurrentAdmin } from "@/services/auth-guard"
import { ok, fail, type Result } from "@/services/result"
import { ORDER_STATUS_PAGADO } from "@/services/order-service"

const RangeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  granularity: z.enum(["hour", "day", "month"]),
})

export type ReportRange = z.infer<typeof RangeSchema>

export type SalesSummary = {
  totalRevenue: number
  orderCount: number
  averageTicket: number
}

export type TopProduct = {
  productName: string
  variantName: string | null
  unitsSold: number
  revenue: number
}

export type SalesByTable = {
  tableId: number
  tableNumber: number | null
  orderCount: number
  revenue: number
}

export type TimeBucket = {
  bucket: string
  revenue: number
  orderCount: number
}

type OrderRow = {
  id: number
  total: number | null
  table_id: number | null
  created_at: string
  tables: { table_number: number | null } | null
  order_items: Array<{
    product_name: string | null
    variant_name: string | null
    product_price: number | null
    product_quantity: number
  }> | null
}


async function fetchOrdersInRange(range: ReportRange) {
  const parsed = RangeSchema.safeParse(range)
  if (!parsed.success) return { ok: false as const, error: "Rango inválido" }

  const auth = await requireCurrentAdmin()
  if (!auth.ok) return { ok: false as const, error: auth.error }

  const { supabase, restaurantId } = auth.data

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, total, table_id, created_at, tables(table_number), order_items(product_name, variant_name, product_price, product_quantity)"
    )
    .eq("restaurant_id", restaurantId)
    .eq("status_id", ORDER_STATUS_PAGADO)
    .gte("created_at", parsed.data.from)
    .lt("created_at", parsed.data.to)

  if (error) return { ok: false as const, error: "Error al leer pedidos" }

  return { ok: true as const, data: (data ?? []) as unknown as OrderRow[], range: parsed.data }
}

export async function getSalesSummary(range: ReportRange): Promise<Result<SalesSummary>> {
  const res = await fetchOrdersInRange(range)
  if (!res.ok) return fail(res.error)

  const totalRevenue = res.data.reduce((sum, o) => sum + Number(o.total ?? 0), 0)
  const orderCount = res.data.length
  const averageTicket = orderCount > 0 ? totalRevenue / orderCount : 0

  return ok({ totalRevenue, orderCount, averageTicket })
}

export async function getTopProducts(range: ReportRange): Promise<Result<TopProduct[]>> {
  const res = await fetchOrdersInRange(range)
  if (!res.ok) return fail(res.error)

  const accumulator = new Map<string, TopProduct>()

  for (const order of res.data) {
    for (const item of order.order_items ?? []) {
      const productName = item.product_name ?? "Producto"
      const variantName = item.variant_name
      const key = `${productName}::${variantName ?? ""}`
      const existing = accumulator.get(key)
      const lineRevenue = Number(item.product_price ?? 0) * item.product_quantity
      if (existing) {
        existing.unitsSold += item.product_quantity
        existing.revenue += lineRevenue
      } else {
        accumulator.set(key, {
          productName,
          variantName,
          unitsSold: item.product_quantity,
          revenue: lineRevenue,
        })
      }
    }
  }

  const list = Array.from(accumulator.values()).sort((a, b) => b.unitsSold - a.unitsSold)
  return ok(list)
}

export async function getSalesByTable(range: ReportRange): Promise<Result<SalesByTable[]>> {
  const res = await fetchOrdersInRange(range)
  if (!res.ok) return fail(res.error)

  const accumulator = new Map<number, SalesByTable>()

  for (const order of res.data) {
    if (order.table_id == null) continue
    const tableNumber = order.tables?.table_number ?? null
    const existing = accumulator.get(order.table_id)
    if (existing) {
      existing.orderCount += 1
      existing.revenue += Number(order.total ?? 0)
    } else {
      accumulator.set(order.table_id, {
        tableId: order.table_id,
        tableNumber,
        orderCount: 1,
        revenue: Number(order.total ?? 0),
      })
    }
  }

  const list = Array.from(accumulator.values()).sort((a, b) => b.revenue - a.revenue)
  return ok(list)
}

function bucketKey(date: Date, granularity: ReportRange["granularity"]): string {
  if (granularity === "hour") {
    const d = new Date(date)
    d.setMinutes(0, 0, 0)
    return d.toISOString()
  }
  if (granularity === "day") {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }
  // month
  const d = new Date(date.getFullYear(), date.getMonth(), 1)
  return d.toISOString()
}

export async function getSalesTimeline(range: ReportRange): Promise<Result<TimeBucket[]>> {
  const res = await fetchOrdersInRange(range)
  if (!res.ok) return fail(res.error)

  const accumulator = new Map<string, TimeBucket>()

  for (const order of res.data) {
    const key = bucketKey(new Date(order.created_at), res.range.granularity)
    const existing = accumulator.get(key)
    if (existing) {
      existing.orderCount += 1
      existing.revenue += Number(order.total ?? 0)
    } else {
      accumulator.set(key, {
        bucket: key,
        orderCount: 1,
        revenue: Number(order.total ?? 0),
      })
    }
  }

  const list = Array.from(accumulator.values()).sort((a, b) =>
    a.bucket.localeCompare(b.bucket)
  )
  return ok(list)
}
