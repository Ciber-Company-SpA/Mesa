import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { revalidateMenu } from "@/app/actions/revalidate-menu"
import { logger } from "@/lib/logger"
import { useUploadImage } from "@/hooks/useUploadImage"
import type { ProductVariant } from "@/types/product-variant"

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

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

    const cleanName = variantName.trim()
    const cleanPrice = Number(variantPrice)

    if (!cleanName) throw new Error("El nombre de la variante es obligatorio")
    if (!cleanPrice || cleanPrice <= 0) throw new Error("El precio debe ser mayor a 0")

    let imageUrl = currentImageUrl
    let imagePublicId = currentImagePublicId
    let oldPublicIdToDelete: string | null = null

    // 1. Subir imagen nueva (si la hay), pero NO borrar la vieja todavía
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

    // 2. Actualizar la BD primero
    const { error } = await supabase
      .from("product_variants")
      .update({
        variant_name: cleanName,
        variant_price: cleanPrice,
        variant_image: imageUrl,
        variant_image_public_id: imagePublicId,
      })
      .eq("id", variant.id)

    if (error) throw error
    
    await revalidateMenu()

    // 3. Recién ahora borrar la imagen vieja
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
    setError(getErrorMessage(err, "Error al guardar variante"))
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
    updateVariant
  }
}
