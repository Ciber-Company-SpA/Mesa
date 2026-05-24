import { useRef, useState } from "react"
import { logger } from "@/lib/logger"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"
import { useConfirmDialog } from "@/hooks/useConfirmDialog"
import { deleteCategoryAction } from "@/app/actions/category-actions"

export function useDeleteCategory() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const categoryIdRef = useRef<number | null>(null)
  const { confirm, dialog } = useConfirmDialog()

  const { run: deleteCategoryWithRetry, isPending } = useOfflineRetry(async () => {
    if (!categoryIdRef.current) return false

    const result = await deleteCategoryAction({
      categoryId: categoryIdRef.current,
    })

    if (!result.ok) {
      throw new Error(result.error)
    }

    return true
  })

  async function deleteCategory(categoryId: number) {
    return confirm({
      title: "¿Seguro que quieres eliminar esta categoría?",
      description: "La categoría se borrará del menú y esta acción no se puede deshacer.",
      onConfirm: async () => {
        try {
          categoryIdRef.current = categoryId
          setLoading(true)
          setError("")
          return await deleteCategoryWithRetry()
        } catch (err: unknown) {
          if (isNetworkError(err)) return false
          logger.error("Error eliminando categoria", err)
          setError(err instanceof Error ? err.message : "Error al eliminar categoría")
          return false
        } finally {
          setLoading(false)
        }
      },
    })
  }

  return {
    loading: loading || isPending,
    error,
    deleteCategory,
    dialog,
  }
}