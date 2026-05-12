import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"

export function useDeleteCategory() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function deleteCategory(categoryId: number) {
    const confirmed = confirm("¿Seguro que quieres eliminar esta categoría?")

    if (!confirmed) return false

    try {
      setLoading(true)
      setError("")

      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", categoryId)

      if (error) throw error

      return true
    } catch (err: unknown) {
      logger.error("Error eliminando categoría", err)
      setError("Error al eliminar categoría")
      return false
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    deleteCategory
  }
}
