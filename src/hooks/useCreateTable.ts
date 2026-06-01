import { useRef, useState } from "react"
import { useOfflineRetry } from "@/hooks/useOfflineRetry"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { handleMutationError } from "@/lib/hooks/handle-mutation-error"
import { createTableAction } from "@/app/actions/table-actions"
import { invalidateTableCaches } from "@/lib/cache-invalidation"
import { CreateTableSchema } from "@/lib/validation/table"

export function useCreateTable() {
  const { restaurantId, loading: loadingId } = useRestaurantId()
  const successRef = useRef(false)

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

    const validation = CreateTableSchema.safeParse({
      tableNumber: Number(tableNumber),
      restaurantId,
    })

    if (!validation.success) {
      throw new Error(validation.error.issues[0]?.message ?? "Datos inválidos")
    }

    const result = await createTableAction(validation.data)

    if (!result.ok) {
      throw new Error(result.error)
    }

    invalidateTableCaches()
    successRef.current = true
  })

  async function createTable(): Promise<boolean> {
    if (loading || loadingId) return false

    successRef.current = false

    try {
      setLoading(true)
      setError("")
      await createTableWithRetry()
      if (successRef.current) {
        setTableNumber("")
        return true
      }
      return false
    } catch (err: unknown) {
      handleMutationError(err, {
        logTag: "Error creando mesa",
        fallback: "Error al crear mesa",
        setError,
      })
      return false
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
