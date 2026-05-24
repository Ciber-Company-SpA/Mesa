import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { logger } from "@/lib/logger"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { createCategoryAction } from "@/app/actions/category-actions"

export function useCreateCategory() {
  const router = useRouter()
  const { restaurantId, loading: loadingId } = useRestaurantId()
  const pendingNameRef = useRef("")

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

    router.replace("/admin/categories")
  })

  async function createCategory(trimmedName: string) {
    if (loading || loadingId) return

    try {
      pendingNameRef.current = trimmedName
      setLoading(true)
      setError("")

      await createCategoryWithRetry()
    } catch (err: unknown) {
      if (isNetworkError(err)) return
      logger.error("Error creando categoria", err)
      setError(err instanceof Error ? err.message : "Error al crear categoría")
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