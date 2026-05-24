import { useRef, useState } from "react"
import { logger } from "@/lib/logger"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"
import { useConfirmDialog } from "@/hooks/useConfirmDialog"
import { deleteProductAction } from "@/app/actions/product-actions"

type PendingDeleteProduct = {
  productId: number
  productImagePublicId?: string
}

export function useDeleteProduct() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const pendingDeleteRef = useRef<PendingDeleteProduct | null>(null)
  const { confirm, dialog } = useConfirmDialog()

  const { run: deleteProductWithRetry, isPending } = useOfflineRetry(async () => {
    const pendingDelete = pendingDeleteRef.current
    if (!pendingDelete) return false

    // 1. Borrar imagen de Cloudinary (si tiene)
    if (pendingDelete.productImagePublicId) {
      const response = await fetch("/api/cloudinary/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: pendingDelete.productImagePublicId,
          productId: pendingDelete.productId,
        }),
      })

      if (!response.ok) throw new Error("Error al eliminar imagen")
    }

    // 2. Borrar producto del server
    const result = await deleteProductAction({
      productId: pendingDelete.productId,
      productImagePublicId: pendingDelete.productImagePublicId ?? null,
    })

    if (!result.ok) {
      throw new Error(result.error)
    }

    return true
  })

  async function deleteProduct(productId: number, productImagePublicId?: string) {
    return confirm({
      title: "¿Seguro que quieres eliminar este producto?",
      description: "El producto se borrará del menú y esta acción no se puede deshacer.",
      onConfirm: async () => {
        try {
          pendingDeleteRef.current = { productId, productImagePublicId }
          setLoading(true)
          setError("")

          return await deleteProductWithRetry()
        } catch (err: unknown) {
          if (isNetworkError(err)) return false
          logger.error("Error eliminando producto", err)
          setError(err instanceof Error ? err.message : "Error al eliminar producto")
          return false
        } finally {
          setLoading(false)
        }
      },
    })
  }

  return { deleteProduct, loading: loading || isPending, error, dialog }
}