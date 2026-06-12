import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { playNewOrderSound } from "@/lib/notification-sound"
import { showOrderNotification } from "@/lib/order-notifications"

export type ServiceCall = {
  id: number
  tableId: number
  tableNumber: number | null
  dinerLabel: string | null
  createdAt: string
}

type ServiceCallRow = {
  id: number
  table_id: number
  diner_label: string | null
  created_at: string
  tables: { table_number: number | null } | { table_number: number | null }[] | null
}

function mapRow(row: ServiceCallRow): ServiceCall {
  const tablesRel = row.tables
  const table = Array.isArray(tablesRel) ? tablesRel[0] : tablesRel
  return {
    id: row.id,
    tableId: row.table_id,
    tableNumber: table?.table_number ?? null,
    dinerLabel: row.diner_label ?? null,
    createdAt: row.created_at,
  }
}

/**
 * Llamadas de servicio pendientes ("pedir la cuenta") del restaurante.
 * Se suscribe por Realtime: cuando entra una llamada nueva suena la misma
 * alerta de pedidos + notificación del sistema. Cualquier mesero del
 * restaurante puede atenderla.
 */
export function useServiceCalls(restaurantId: number | null) {
  const [calls, setCalls] = useState<ServiceCall[]>([])

  const knownIdsRef = useRef<Set<number>>(new Set())
  const initialLoadDoneRef = useRef(false)

  const fetchCalls = useCallback(async () => {
    if (!restaurantId) return
    const { data, error } = await supabase
      .from("service_calls")
      .select("id, table_id, diner_label, created_at, tables(table_number)")
      .eq("restaurant_id", restaurantId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })

    if (error) {
      logger.error("Error cargando llamadas de servicio", error)
      return
    }

    const incoming = ((data ?? []) as unknown as ServiceCallRow[]).map(mapRow)

    if (initialLoadDoneRef.current) {
      const newlyArrived = incoming.filter((c) => !knownIdsRef.current.has(c.id))
      if (newlyArrived.length > 0) {
        playNewOrderSound()
        for (const c of newlyArrived) {
          const tableLabel = c.tableNumber != null ? `Mesa ${c.tableNumber}` : `Mesa #${c.tableId}`
          showOrderNotification({
            title: `🧾 ${tableLabel} pide la cuenta`,
            body: c.dinerLabel ? `Lo pidió ${c.dinerLabel}` : "Acércate cuando puedas",
            tag: `service-call-${c.id}`,
          })
        }
      }
    }
    knownIdsRef.current = new Set(incoming.map((c) => c.id))
    initialLoadDoneRef.current = true

    setCalls(incoming)
  }, [restaurantId])

  useEffect(() => {
    if (!restaurantId) return

    fetchCalls().catch(() => undefined)

    const refetch = () => {
      fetchCalls().catch(() => undefined)
    }

    const channel = supabase
      .channel(`service-calls-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_calls",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        refetch
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logger.warn(`Realtime service-calls channel: ${status}`)
        }
      })

    const onVisible = () => {
      if (document.visibilityState === "visible") refetch()
    }
    window.addEventListener("focus", refetch)
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener("focus", refetch)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [restaurantId, fetchCalls])

  const attend = useCallback(
    async (callId: number, staffId: number | null): Promise<boolean> => {
      const { error } = await supabase
        .from("service_calls")
        .update({
          status: "attended",
          attended_at: new Date().toISOString(),
          attended_by: staffId,
        })
        .eq("id", callId)

      if (error) {
        logger.error("Error atendiendo llamada de servicio", error)
        return false
      }
      setCalls((prev) => prev.filter((c) => c.id !== callId))
      knownIdsRef.current.delete(callId)
      return true
    },
    []
  )

  return { calls, attend, refresh: fetchCalls }
}
