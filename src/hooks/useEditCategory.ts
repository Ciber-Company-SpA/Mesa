import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { revalidateMenu } from "@/app/actions/revalidate-menu"
import { logger } from "@/lib/logger"
import { decodeId } from "@/lib/hashids"
import { getSafeErrorMessage } from "@/lib/safe-error"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"

const safeErrors = [
  "Categoria no encontrada",
  "El nombre de la categoria es obligatorio"
]

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
    if (!categoryId) throw new Error("Categoria no encontrada")

    const { data, error } = await supabase
      .from("categories")
      .select("id, category_name")
      .eq("id", categoryId)
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error("Categoria no encontrada")

    setCategoryName(data.category_name)
    setLoadError("")
  })

  const { run: updateCategoryWithRetry, isPending: isSavePending } = useOfflineRetry(async () => {
    const cleanCategoryName = pendingNameRef.current.trim()

    if (!cleanCategoryName) {
      throw new Error("El nombre de la categoria es obligatorio")
    }

    const { error } = await supabase
      .from("categories")
      .update({ category_name: cleanCategoryName })
      .eq("id", categoryId)

    if (error) throw error
    await revalidateMenu()
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
        setLoadError(getSafeErrorMessage(err, "Error al cargar categoria", safeErrors))
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
      setError(getSafeErrorMessage(err, "Error al guardar cambios", safeErrors))
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
    updateCategory
  }
}
