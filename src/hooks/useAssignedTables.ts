import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"

export type AssignedTable = {
  id: number
  tableNumber: number | null
}

// Devuelve las mesas que el mesero (staffId) está atendiendo ahora mismo,
// según `tables.current_waiter_id`. Reescucha cambios en realtime para
// reflejar inmediatamente cuando se asigna o libera una mesa.
export function useAssignedTables(staffId: number | null, restaurantId: number | null) {
  const [tables, setTables] = useState<AssignedTable[]>([])
  const [loading, setLoading] = useState(true)

  const staffIdRef = useRef(staffId)
  useEffect(() => {
    staffIdRef.current = staffId
  }, [staffId])

  const fetchTables = useCallback(async () => {
    const id = staffIdRef.current
    if (!id) {
      setTables([])
      return
    }
    const { data, error } = await supabase
      .from("tables")
      .select("id, table_number")
      .eq("current_waiter_id", id)

    if (error) {
      logger.error("Error cargando mesas asignadas", error)
      return
    }
    setTables(
      (data ?? []).map((row) => ({
        id: row.id,
        tableNumber: row.table_number,
      }))
    )
  }, [])

  useEffect(() => {
    if (!staffId) {
      setTables([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchTables().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [staffId, fetchTables])

  useEffect(() => {
    if (!staffId || !restaurantId) return

    const refetch = () => {
      fetchTables().catch(() => undefined)
    }

    const channel = supabase
      .channel(`tables-assignment-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tables",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        refetch
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [staffId, restaurantId, fetchTables])

  return { tables, loading, refresh: fetchTables }
}
