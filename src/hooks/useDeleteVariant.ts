import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useConfirmDialog } from "@/hooks/useConfirmDialog"

export function useDeleteVariant() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { confirm, dialog } = useConfirmDialog()

  async function deleteVariant(variantId: number, variantImagePublicId: string | null) {
    return confirm({
      title: "¿Seguro que quieres eliminar esta variante?",
      description: "La variante se borrará del producto y esta acción no se puede deshacer.",
      onConfirm: async () => {
        try {
          setLoading(true)
          setError("")

          if (variantImagePublicId) {
            await fetch("/api/cloudinary/delete", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                publicId: variantImagePublicId,
                variantId: variantId,
              }),
            })
          }

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
      },
    })
  }

  return { deleteVariant, loading, error, dialog }
}
