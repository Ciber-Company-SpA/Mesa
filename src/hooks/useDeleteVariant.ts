import { useRef, useState } from "react"
import { useOfflineRetry } from "@/hooks/useOfflineRetry"
import { useConfirmDialog } from "@/hooks/useConfirmDialog"
import { handleMutationError } from "@/lib/hooks/handle-mutation-error"
import { deleteVariantAction } from "@/app/actions/variant-actions"
import { invalidateProductCaches } from "@/lib/cache-invalidation"

export function useDeleteVariant() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const pendingVariantIdRef = useRef<number | null>(null)
  const { confirm, dialog } = useConfirmDialog()

  const { run: deleteVariantWithRetry, isPending } = useOfflineRetry(async () => {
    const variantId = pendingVariantIdRef.current
    if (!variantId) return false

    const result = await deleteVariantAction({ variantId })

    if (!result.ok) {
      throw new Error(result.error)
    }

    invalidateProductCaches()
    return true
  })

  async function deleteVariant(variantId: number) {
    return confirm({
      title: "¿Seguro que quieres eliminar esta variante?",
      description: "La variante se borrará del producto y esta acción no se puede deshacer.",
      onConfirm: async () => {
        try {
          pendingVariantIdRef.current = variantId
          setLoading(true)
          setError("")

          return await deleteVariantWithRetry()
        } catch (err: unknown) {
          handleMutationError(err, {
            logTag: "Error eliminando variante",
            fallback: "Error al eliminar variante",
            setError,
          })
          return false
        } finally {
          setLoading(false)
        }
      },
    })
  }

  return { deleteVariant, loading: loading || isPending, error, dialog }
}
