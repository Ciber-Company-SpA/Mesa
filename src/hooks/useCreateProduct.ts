import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useUploadImage } from "@/hooks/useUploadImage"

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function useCreateProduct() {
  const router = useRouter()
  const { restaurantId, loading: loadingId } = useRestaurantId()
  const { uploadImage, uploading } = useUploadImage()

  const [productName, setProductName] = useState("")
  const [productDescription, setProductDescription] = useState("")
  const [productPrice, setProductPrice] = useState("")
  const [productImage, setProductImage] = useState<File | null>(null)
  const [categoryId, setCategoryId] = useState<number | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function createProduct() {
    if (loading || loadingId) return

    try {
      setLoading(true)
      setError("")

      const cleanName = productName.trim()
      const cleanPrice = Number(productPrice)

      if (!cleanName) {
        throw new Error("El nombre del producto es obligatorio")
      }

      if (!cleanPrice || cleanPrice <= 0) {
        throw new Error("El precio debe ser mayor a 0")
      }

      if (!categoryId) {
        throw new Error("Debes seleccionar una categoría")
      }

      if (!restaurantId) {
        throw new Error("No se encontró el restaurante")
      }

      let imageUrl: string | null = null

      if (productImage) {
        imageUrl = await uploadImage(
          productImage,
          process.env.NEXT_PUBLIC_CLOUDINARY_PRODUCTS_PRESET!
        )
      }

      const { error } = await supabase
        .from("products")
        .insert({
          product_name: cleanName,
          product_description: productDescription.trim() || null,
          product_price: cleanPrice,
          product_image: imageUrl,
          category_id: categoryId,
          restaurant_id: restaurantId,
          status_id: 1
        })

      if (error) throw error

      router.replace("/admin/products")
    } catch (err: unknown) {
      logger.error("Error creando producto", err)
      setError(getErrorMessage(err, "Error al crear producto"))
    } finally {
      setLoading(false)
    }
  }

  return {
    productName,
    setProductName,
    productDescription,
    setProductDescription,
    productPrice,
    setProductPrice,
    productImage,
    setProductImage,
    categoryId,
    setCategoryId,
    loading: loading || uploading,
    error,
    createProduct
  }
}