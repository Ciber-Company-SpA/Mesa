import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useCache } from "@/hooks/useCache"

export type Period = "hoy" | "semana" | "mes"

export type VentasStats = {
  totalVentas: number
  pedidosCerrados: number
  ticketPromedio: number
  horaPico: string
  chartLabels: string[]
  chartValues: number[]
}

function getDateRange(period: Period) {
  const now = new Date()
  const to = new Date(now)
  to.setHours(23, 59, 59, 999)
  const from = new Date(now)
  if (period === "hoy") {
    from.setHours(0, 0, 0, 0)
  } else if (period === "semana") {
    from.setDate(from.getDate() - 6)
    from.setHours(0, 0, 0, 0)
  } else {
    from.setDate(from.getDate() - 29)
    from.setHours(0, 0, 0, 0)
  }
  return { from, to }
}

export function useVentasStats(period: Period) {
  const { restaurantId, loading: loadingId } = useRestaurantId()
  const todayKey = new Date().toISOString().slice(0, 10)

  const fetchStats = useCallback(async (): Promise<VentasStats> => {
    const { from, to } = getDateRange(period)

    const { data, error } = await supabase
      .from("orders")
      .select("id, total, created_at")
      .eq("restaurant_id", restaurantId)
      .eq("status_id", 4)
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: true })

    if (error) throw error

    const rows = (data ?? []) as { id: number; total: number; created_at: string }[]

    const totalVentas = rows.reduce((s, r) => s + Number(r.total ?? 0), 0)
    const pedidosCerrados = rows.length
    const ticketPromedio = pedidosCerrados > 0 ? Math.round(totalVentas / pedidosCerrados) : 0

    // Hora pico: bucket por hora del día (siempre, independiente del período)
    const hourBuckets = new Array<number>(24).fill(0)
    for (const r of rows) {
      const h = new Date(r.created_at).getHours()
      hourBuckets[h] += Number(r.total ?? 0)
    }
    const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets))
    const horaPico =
      pedidosCerrados === 0
        ? "–"
        : `${String(peakHour).padStart(2, "0")}:00–${String(peakHour + 1).padStart(2, "0")}:00`

    // Chart
    let chartLabels: string[]
    let chartValues: number[]

    if (period === "hoy") {
      chartLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}h`)
      chartValues = hourBuckets
    } else {
      const days = period === "semana" ? 7 : 30
      const { from: rangeFrom } = getDateRange(period)
      chartLabels = []
      chartValues = []
      for (let i = 0; i < days; i++) {
        const d = new Date(rangeFrom)
        d.setDate(d.getDate() + i)
        const key = d.toISOString().slice(0, 10)
        const label = d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric" })
        const value = rows
          .filter((r) => r.created_at.slice(0, 10) === key)
          .reduce((s, r) => s + Number(r.total ?? 0), 0)
        chartLabels.push(label)
        chartValues.push(value)
      }
    }

    return { totalVentas, pedidosCerrados, ticketPromedio, horaPico, chartLabels, chartValues }
  }, [restaurantId, period])

  const { data, isLoading, isPendingRetry } = useCache<VentasStats>(
    `ventas-stats-${restaurantId ?? "pending"}-${period}-${todayKey}`,
    fetchStats,
    { enabled: Boolean(restaurantId), revalidateOnMount: true }
  )

  return {
    stats: data ?? null,
    loading: loadingId || isLoading || isPendingRetry,
  }
}
