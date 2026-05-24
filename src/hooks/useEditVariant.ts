import { useState } from "react"
import { logger } from "@/lib/logger"
import { useUploadImage } from "@/hooks/useUploadImage"
import { updateVariantAction } from "@/app/actions/variant-actions"
import type { ProductVariant } from "@/types/product-variant"

export function useEditVariant(variant: ProductVariant) {
  const { uploadImage, uploading } = useUploadImage()

  const [variantName, setVariantName] = useState(variant.variant_name)
  const [variantPrice, setVariantPrice] = useState(String(variant.variant_price))
  const [variantImage, setVariantImage] = useState<File | null>(null)
  const [currentImageUrl] = useState<string | null>(variant.variant_image)
  const [currentImagePublicId] = useState<string | null>(variant.variant_image_public_id)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function updateVariant() {
    if (loading) return

    try {
      setLoading(true)
      setError("")

      let imageUrl = currentImageUrl
      let imagePublicId = currentImagePublicId
      let oldPublicIdToDelete: string | null = null

      if (variantImage) {
        const uploaded = await uploadImage(
          variantImage,
          process.env.NEXT_PUBLIC_CLOUDINARY_PRODUCTS_PRESET!
        )

        if (uploaded) {
          if (currentImagePublicId) {
            oldPublicIdToDelete = currentImagePublicId
          }
          imageUrl = uploaded.secure_url
          imagePublicId = uploaded.public_id
        }
      }

      const result = await updateVariantAction({
        variantId: variant.id,
        name: variantName.trim(),
        price: Number(variantPrice),
        imageUrl,
        imagePublicId,
      })

      if (!result.ok) {
        throw new Error(result.error)
      }

      if (oldPublicIdToDelete) {
        await fetch("/api/cloudinary/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicId: oldPublicIdToDelete,
            variantId: variant.id,
          }),
        }).catch((err) => logger.warn("No se pudo borrar imagen vieja", err))
      }

      return true
    } catch (err: unknown) {
      logger.error("Error actualizando variante", err)
      setError(err instanceof Error ? err.message : "Error al guardar variante")
      return false
    } finally {
      setLoading(false)
    }
  }

  return {
    variantName, setVariantName,
    variantPrice, setVariantPrice,
    variantImage, setVariantImage,
    currentImageUrl,
    loading: loading || uploading,
    error,
    updateVariant,
  }
}