
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"

export function useDeleteProduct() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function deleteProduct(productId: number) {
    const confirmed = confirm("¿Seguro que quieres eliminar este producto?")

    if (!confirmed) return false

    try {
      setLoading(true)
      setError("")

      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId)

      if (error) throw error

      return true
    } catch (err) {
      logger.error("Error eliminando producto", err)
      setError(err instanceof Error ? err.message : "Error al eliminar producto")
      return false
    } finally {
      setLoading(false)
    }
  }

  return { deleteProduct, loading, error }
}