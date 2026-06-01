import { useRef, useState } from "react"
import { useOfflineRetry } from "@/hooks/useOfflineRetry"
import { useConfirmDialog } from "@/hooks/useConfirmDialog"
import { handleMutationError } from "@/lib/hooks/handle-mutation-error"
import { deleteCategoryAction } from "@/app/actions/category-actions"
import { invalidateCategoryCaches } from "@/lib/cache-invalidation"

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

    invalidateCategoryCaches()
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
          handleMutationError(err, {
            logTag: "Error eliminando categoria",
            fallback: "Error al eliminar categoría",
            setError,
          })
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