"use server"

import { z } from "zod"
import { requireCurrentAdmin } from "@/services/auth-guard"
import { ok, fail, type Result } from "@/services/result"

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

export type SalesReport = {
  summary: SalesSummary
  topProducts: TopProduct[]
  salesByTable: SalesByTable[]
  timeline: TimeBucket[]
}

type RpcResult = {
  summary: { totalRevenue: number | string; orderCount: number; averageTicket: number | string }
  topProducts: Array<{
    productName: string | null
    variantName: string | null
    unitsSold: number
    revenue: number | string
  }>
  salesByTable: Array<{
    tableId: number
    tableNumber: number | null
    orderCount: number
    revenue: number | string
  }>
  timeline: Array<{ bucket: string; revenue: number | string; orderCount: number }>
}

function toNum(v: number | string | null | undefined): number {
  return v == null ? 0 : Number(v)
}

export async function getSalesReport(range: ReportRange): Promise<Result<SalesReport>> {
  const parsed = RangeSchema.safeParse(range)
  if (!parsed.success) return fail("Rango inválido")

  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase, restaurantId } = auth.data

  const { data, error } = await supabase.rpc("get_sales_report", {
    p_restaurant_id: restaurantId,
    p_from: parsed.data.from,
    p_to: parsed.data.to,
    p_granularity: parsed.data.granularity,
  })

  if (error || !data) return fail("Error al cargar el reporte")

  const raw = data as RpcResult

  return ok({
    summary: {
      totalRevenue: toNum(raw.summary?.totalRevenue),
      orderCount: raw.summary?.orderCount ?? 0,
      averageTicket: toNum(raw.summary?.averageTicket),
    },
    topProducts: (raw.topProducts ?? []).map((p) => ({
      productName: p.productName ?? "Producto",
      variantName: p.variantName,
      unitsSold: p.unitsSold,
      revenue: toNum(p.revenue),
    })),
    salesByTable: (raw.salesByTable ?? []).map((t) => ({
      tableId: t.tableId,
      tableNumber: t.tableNumber,
      orderCount: t.orderCount,
      revenue: toNum(t.revenue),
    })),
    timeline: (raw.timeline ?? []).map((b) => ({
      bucket: b.bucket,
      orderCount: b.orderCount,
      revenue: toNum(b.revenue),
    })),
  })
}
