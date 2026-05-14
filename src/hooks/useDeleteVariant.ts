import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"

export function useDeleteVariant() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function deleteVariant(variantId: number, variant_image_public_id: string | null) {
    const confirmed = confirm("¿Seguro que quieres eliminar esta variante?")
    if (!confirmed) return false

    try {
      setLoading(true)
      setError("")

      // 1. Borrar imagen de Cloudinary
      if (variant_image_public_id) {
        await fetch("/api/cloudinary/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicId: variant_image_public_id }),
        })
      }

      // 2. Borrar variante de Supabase
      const { error } = await supabase
        .from("product_variants")
        .delete()
        .eq("id", variantId)

      if (error) throw error

      return true
    } catch (err) {
      logger.error("Error eliminando variante", err)
      setError(err instanceof Error ? err.message : "Error al eliminar variante")
      return false
    } finally {
      setLoading(false)
    }
  }

  return { deleteVariant, loading, error }
}