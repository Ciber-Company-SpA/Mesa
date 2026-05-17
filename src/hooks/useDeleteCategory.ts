import { useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"
import { useConfirmDialog } from "@/hooks/useConfirmDialog"

export function useDeleteCategory() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const categoryIdRef = useRef<number | null>(null)
  const { confirm, dialog } = useConfirmDialog()

  const { run: deleteCategoryWithRetry, isPending } = useOfflineRetry(async () => {
    if (!categoryIdRef.current) return false

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryIdRef.current)

    if (error) throw error

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
          setError("Error al eliminar categoría")
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
