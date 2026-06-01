import { useRef, useState } from "react"
import { useOfflineRetry } from "@/hooks/useOfflineRetry"
import { useConfirmDialog } from "@/hooks/useConfirmDialog"
import { handleMutationError } from "@/lib/hooks/handle-mutation-error"
import { deleteProductAction } from "@/app/actions/product-actions"
import { invalidateProductCaches } from "@/lib/cache-invalidation"

export function useDeleteProduct() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const pendingProductIdRef = useRef<number | null>(null)
  const { confirm, dialog } = useConfirmDialog()

  const { run: deleteProductWithRetry, isPending } = useOfflineRetry(async () => {
    const productId = pendingProductIdRef.current
    if (!productId) return false

    const result = await deleteProductAction({ productId })

    if (!result.ok) {
      throw new Error(result.error)
    }

    invalidateProductCaches()
    return true
  })

  async function deleteProduct(productId: number) {
    return confirm({
      title: "¿Seguro que quieres eliminar este producto?",
      description: "El producto se borrará del menú y esta acción no se puede deshacer.",
      onConfirm: async () => {
        try {
          pendingProductIdRef.current = productId
          setLoading(true)
          setError("")

          return await deleteProductWithRetry()
        } catch (err: unknown) {
          handleMutationError(err, {
            logTag: "Error eliminando producto",
            fallback: "Error al eliminar producto",
            setError,
          })
          return false
        } finally {
          setLoading(false)
        }
      },
    })
  }

  return { deleteProduct, loading: loading || isPending, error, dialog }
}