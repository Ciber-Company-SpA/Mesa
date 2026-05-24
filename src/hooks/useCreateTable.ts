import { useState } from "react"
import { useRouter } from "next/navigation"
import { logger } from "@/lib/logger"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { createTableAction } from "@/app/actions/table-actions"

export function useCreateTable() {
  const router = useRouter()
  const { restaurantId, loading: loadingId } = useRestaurantId()

  const [tableNumber, setTableNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const { run: createTableWithRetry, isPending } = useOfflineRetry(async () => {
    if (!restaurantId) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw { isNetworkError: true, message: "Sin conexion" }
      }
      throw new Error("No se encontró el restaurante")
    }

    const result = await createTableAction({
      tableNumber: Number(tableNumber),
      restaurantId,
    })

    if (!result.ok) {
      throw new Error(result.error)
    }

    router.replace("/admin/tables")
  })

  async function createTable() {
    if (loading || loadingId) return

    try {
      setLoading(true)
      setError("")
      await createTableWithRetry()
    } catch (err: unknown) {
      if (isNetworkError(err)) return
      logger.error("Error creando mesa", err)
      setError(err instanceof Error ? err.message : "Error al crear mesa")
    } finally {
      setLoading(false)
    }
  }

  return {
    tableNumber,
    setTableNumber,
    loading: loading || isPending,
    error,
    createTable,
  }
}