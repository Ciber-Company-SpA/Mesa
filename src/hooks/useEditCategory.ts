import { useEffect, useRef, useState } from "react"
import { useOfflineRetry } from "@/hooks/useOfflineRetry"
import { handleMutationError } from "@/lib/hooks/handle-mutation-error"
import {
  updateCategoryAction,
  getCategoryForEditAction,
} from "@/app/actions/category-actions"

export function useEditCategory(categoryId: number | null) {
  const pendingNameRef = useRef("")
  const successRef = useRef(false)

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

    successRef.current = true
  })

  useEffect(() => {
    if (!categoryId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- modal cerrado: no hay id, salimos del estado de carga inicial.
      setLoading(false)
      return
    }

    let cancelled = false
    async function loadCategory() {
      try {
        setLoading(true)
        setLoadError("")
        setError("")
        await loadCategoryWithRetry()
      } catch (err: unknown) {
        if (cancelled) return
        handleMutationError(err, {
          logTag: "Error cargando categoria",
          fallback: "Error al cargar categoría",
          setError: setLoadError,
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCategory()
    return () => { cancelled = true }
  }, [categoryId, loadCategoryWithRetry])

  async function updateCategory(trimmedName: string): Promise<boolean> {
    if (saving) return false

    successRef.current = false

    try {
      pendingNameRef.current = trimmedName
      setSaving(true)
      setError("")
      await updateCategoryWithRetry()
      return successRef.current
    } catch (err: unknown) {
      handleMutationError(err, {
        logTag: "Error actualizando categoria",
        fallback: "Error al guardar cambios",
        setError,
      })
      return false
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
