import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import type { ProductStatus } from "@/types/product-status"

export function useProductStatus() {
  const [statuses, setStatuses] = useState<ProductStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadStatuses() {
      try {
        const { data, error } = await supabase
          .from("product_status")
          .select("*")

        if (error) throw error

        setStatuses((data || []).map((status) => ({
          ...status,
          status_name: status.status_name ?? status.nombre ?? "",
        })))
      } catch (err: unknown) {
        logger.error("Error cargando estados de producto", err)
        setError("Error al cargar estados de producto")
      } finally {
        setLoading(false)
      }
    }

    loadStatuses()
  }, [])

  return { statuses, loading, error }
}
