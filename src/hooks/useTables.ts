import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import type { Table } from "@/types/table"

export function useTables() {
  const { restaurantId, loading: loadingId, error: idError } = useRestaurantId()

  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!restaurantId) return

    async function loadTables() {
      try {
        setLoading(true)
        setError("")

        const { data, error } = await supabase
          .from("tables")
          .select(`
            *,
            qr_codes (
              qr_code,
              qr_active
            )
          `)
          .eq("restaurant_id", restaurantId)
          .order("table_number", { ascending: true })

        if (error) throw error

        setTables(data || [])
      } catch (err) {
        logger.error("Error cargando mesas", err)
        setError(err instanceof Error ? err.message : "Error desconocido")
      } finally {
        setLoading(false)
      }
    }

    loadTables()
  }, [restaurantId])

  return {
    tables,
    loading: loadingId || loading,
    error: idError || error
  }
}