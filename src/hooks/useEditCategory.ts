import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { decodeId } from "@/lib/hashids"
import { logger } from "@/lib/logger"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"
import {
  updateCategoryAction,
  getCategoryForEditAction,
} from "@/app/actions/category-actions"

export function useEditCategory() {
  const router = useRouter()
  const params = useParams()
  const categoryId = decodeId(params.id as string)
  const pendingNameRef = useRef("")

  const [categoryName, setCategoryName] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [error, setError] = useState("")

  const { run: loadCategoryWithRetry, isPending: isLoadPending } = useOfflineRetry(async () => {
    if (!categoryId) throw new Error("Categoría no encontrada")

    const result = await getCategoryForEditAction(categoryId)

    if (!result.ok) {
      throw new Error(result.error)
    }

    setCategoryName(result.data.name)
    setLoadError("")
  })

  const { run: updateCategoryWithRetry, isPending: isSavePending } = useOfflineRetry(async () => {
    if (!categoryId) throw new Error("Categoría no encontrada")

    const result = await updateCategoryAction({
      categoryId,
      name: pendingNameRef.current.trim(),
    })

    if (!result.ok) {
      throw new Error(result.error)
    }

    router.replace("/admin/categories")
  })

  useEffect(() => {
    async function loadCategory() {
      try {
        setLoading(true)
        setLoadError("")
        setError("")
        await loadCategoryWithRetry()
      } catch (err: unknown) {
        if (isNetworkError(err)) return
        logger.error("Error cargando categoria", err)
        setLoadError(err instanceof Error ? err.message : "Error al cargar categoría")
      } finally {
        setLoading(false)
      }
    }

    loadCategory()
  }, [loadCategoryWithRetry])

  async function updateCategory(trimmedName: string) {
    if (saving) return

    try {
      pendingNameRef.current = trimmedName
      setSaving(true)
      setError("")
      await updateCategoryWithRetry()
    } catch (err: unknown) {
      if (isNetworkError(err)) return
      logger.error("Error actualizando categoria", err)
      setError(err instanceof Error ? err.message : "Error al guardar cambios")
    } finally {
      setSaving(false)
    }
  }

  return {
    categoryName,
    setCategoryName,
    loading: loading || isLoadPending,
    saving: saving || isSavePending,
    loadError,
    error,
    updateCategory,
  }
}