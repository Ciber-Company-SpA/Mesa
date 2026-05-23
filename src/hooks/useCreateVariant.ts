import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { revalidateMenu } from "@/app/actions/revalidate-menu"
import { logger } from "@/lib/logger"
import { useUploadImage } from "@/hooks/useUploadImage"

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function useCreateVariant(productId: number) {
  const { uploadImage, uploading } = useUploadImage()

  const [variantName, setVariantName] = useState("")
  const [variantPrice, setVariantPrice] = useState("")
  const [variantImage, setVariantImage] = useState<File | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function createVariant() {
    if (loading) return

    try {
      setLoading(true)
      setError("")

      const cleanName = variantName.trim()
      const cleanPrice = Number(variantPrice)

      if (!cleanName) throw new Error("El nombre de la variante es obligatorio")
      if (!cleanPrice || cleanPrice <= 0) throw new Error("El precio debe ser mayor a 0")

      let imageUrl: string | null = null
      let imagePublicId: string | null = null

      if (variantImage) {
        const result = await uploadImage(
          variantImage,
          process.env.NEXT_PUBLIC_CLOUDINARY_PRODUCTS_PRESET!
        )
        if (result) {
          imageUrl = result.secure_url
          imagePublicId = result.public_id
        }
      }

      const { error } = await supabase
        .from("product_variants")
        .insert({
          product_id: productId,
          variant_name: cleanName,
          variant_price: cleanPrice,
          variant_image: imageUrl,
          variant_image_public_id: imagePublicId,
        })

      if (error) throw error

      // Reset form
      setVariantName("")
      setVariantPrice("")
      setVariantImage(null)
      
      await revalidateMenu()
      return true
    } catch (err: unknown) {
      logger.error("Error creando variante", err)
      setError(getErrorMessage(err, "Error al crear variante"))
      return false
    } finally {
      setLoading(false)
    }
  }

  return {
    variantName, setVariantName,
    variantPrice, setVariantPrice,
    variantImage, setVariantImage,
    loading: loading || uploading,
    error,
    createVariant
  }
}