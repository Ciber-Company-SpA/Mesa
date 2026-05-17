import { useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"

type PendingDeleteProduct = {
  productId: number
  productImagePublicId?: string
}

export function useDeleteProduct() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const pendingDeleteRef = useRef<PendingDeleteProduct | null>(null)

  const { run: deleteProductWithRetry, isPending } = useOfflineRetry(async () => {
    const pendingDelete = pendingDeleteRef.current
    if (!pendingDelete) return false

    if (pendingDelete.productImagePublicId) {
      const response = await fetch("/api/cloudinary/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: pendingDelete.productImagePublicId }),
      })

      if (!response.ok) throw new Error("Error al eliminar imagen")
    }

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", pendingDelete.productId)

    if (error) throw error

    return true
  })

  async function deleteProduct(productId: number, productImagePublicId?: string) {
    const confirmed = confirm("Seguro que quieres eliminar este producto?")
    if (!confirmed) return false

    try {
      pendingDeleteRef.current = { productId, productImagePublicId }
      setLoading(true)
      setError("")

      return await deleteProductWithRetry()
    } catch (err: unknown) {
      if (isNetworkError(err)) return false
      logger.error("Error eliminando producto", err)
      setError("Error al eliminar producto")
      return false
    } finally {
      setLoading(false)
    }
  }

  return { deleteProduct, loading: loading || isPending, error }
}
