import { useRef, useState } from "react"
import { useOfflineRetry } from "@/hooks/useOfflineRetry"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { handleMutationError } from "@/lib/hooks/handle-mutation-error"
import { createCategoryAction } from "@/app/actions/category-actions"
import { invalidateCategoryCaches } from "@/lib/cache-invalidation"

export function useCreateCategory() {
  const { restaurantId, loading: loadingId } = useRestaurantId()
  const pendingNameRef = useRef("")
  const successRef = useRef(false)

  const [categoryName, setCategoryName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const { run: createCategoryWithRetry, isPending } = useOfflineRetry(async () => {
    if (!restaurantId) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw { isNetworkError: true, message: "Sin conexion" }
      }
      throw new Error("No se encontró el restaurante")
    }

    const result = await createCategoryAction({
      name: pendingNameRef.current.trim(),
      restaurantId,
    })

    if (!result.ok) {
      throw new Error(result.error)
    }

    invalidateCategoryCaches()
    successRef.current = true
  })

  async function createCategory(trimmedName: string): Promise<boolean> {
    if (loading || loadingId) return false

    successRef.current = false

    try {
      pendingNameRef.current = trimmedName
      setLoading(true)
      setError("")

      await createCategoryWithRetry()

      if (successRef.current) {
        setCategoryName("")
        return true
      }
      return false
    } catch (err: unknown) {
      handleMutationError(err, {
        logTag: "Error creando categoria",
        fallback: "Error al crear categoría",
        setError,
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  return {
    categoryName,
    setCategoryName,
    loading: loading || isPending,
    error,
    createCategory,
  }
}
