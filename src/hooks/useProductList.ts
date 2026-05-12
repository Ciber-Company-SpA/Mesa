import { useState } from "react"
import { useProducts } from "@/hooks/useProducts"
import { useDeleteProduct } from "@/hooks/useDeleteProduct"

export function useProductList() {
  const { products, loading, error } = useProducts()
  const { deleteProduct, loading: deleting, error: deleteError } = useDeleteProduct()

  const [deletedProductIds, setDeletedProductIds] = useState<number[]>([])

  const visibleProducts = products.filter(
    (product) => !deletedProductIds.includes(product.id)
  )

  async function deleteVisibleProduct(productId: number) {
    const success = await deleteProduct(productId)

    if (success) {
      setDeletedProductIds((prev) => [...prev, productId])
    }

    return success
  }

  return {
    products: visibleProducts,
    totalProducts: visibleProducts.length,
    loading,
    deleting,
    error: error ?? deleteError,
    deleteProduct: deleteVisibleProduct
  }
}