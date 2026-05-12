import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useUploadImage } from "@/hooks/useUploadImage"
import { getSafeErrorMessage } from "@/lib/safe-error"

const safeErrors = [
  "El nombre del producto es obligatorio",
  "El precio debe ser mayor a 0",
  "Debes seleccionar una categoría",
  "No se encontró el restaurante"
]

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

      if (!cleanName) throw new Error("El nombre del producto es obligatorio")
      if (!cleanPrice || cleanPrice <= 0) throw new Error("El precio debe ser mayor a 0")
      if (!categoryId) throw new Error("Debes seleccionar una categoría")
      if (!restaurantId) throw new Error("No se encontró el restaurante")

      let imageUrl: string | null = null
      let imagePublicId: string | null = null

      if (productImage) {
        const result = await uploadImage(
          productImage,
          process.env.NEXT_PUBLIC_CLOUDINARY_PRODUCTS_PRESET!
        )

        if (result) {
          imageUrl = result.secure_url
          imagePublicId = result.public_id
        }
      }

      const { error } = await supabase
        .from("products")
        .insert({
          product_name: cleanName,
          product_description: productDescription.trim() || null,
          product_price: cleanPrice,
          product_image: imageUrl,
          product_image_public_id: imagePublicId,
          category_id: categoryId,
          restaurant_id: restaurantId,
          status_id: 1
        })

      if (error) throw error

      router.replace("/admin/products")
    } catch (err: unknown) {
      logger.error("Error creando producto", err)
      setError(getSafeErrorMessage(err, "Error al crear producto", safeErrors))
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
