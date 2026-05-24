import { useState } from "react"
import { logger } from "@/lib/logger"
import { useConfirmDialog } from "@/hooks/useConfirmDialog"
import { deleteVariantAction } from "@/app/actions/variant-actions"

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

          // 1. Borrar imagen de Cloudinary (si tiene)
          if (variantImagePublicId) {
            await fetch("/api/cloudinary/delete", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                publicId: variantImagePublicId,
                variantId,
              }),
            })
          }

          // 2. Borrar variante del server (valida + DELETE + invalida cache)
          const result = await deleteVariantAction({ variantId })

          if (!result.ok) {
            throw new Error(result.error)
          }

          return true
        } catch (err: unknown) {
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