import { useState } from "react"
import { logger } from "@/lib/logger"
import { useUploadImage } from "@/hooks/useUploadImage"
import { createVariantAction } from "@/app/actions/variant-actions"

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

      let imageUrl: string | null = null
      let imagePublicId: string | null = null

      if (variantImage) {
        const result = await uploadImage(
          variantImage,
          process.env.NEXT_PUBLIC_CLOUDINARY_PRODUCTS_PRESET!
        )

        if (!result) throw new Error("Error al subir imagen")

        imageUrl = result.secure_url
        imagePublicId = result.public_id
      }

      const result = await createVariantAction({
        productId,
        name: variantName.trim(),
        price: Number(variantPrice),
        imageUrl,
        imagePublicId,
      })

      if (!result.ok) {
        throw new Error(result.error)
      }

      setVariantName("")
      setVariantPrice("")
      setVariantImage(null)

      return true
    } catch (err: unknown) {
      logger.error("Error creando variante", err)
      setError(err instanceof Error ? err.message : "Error al crear variante")
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
    createVariant,
  }
}