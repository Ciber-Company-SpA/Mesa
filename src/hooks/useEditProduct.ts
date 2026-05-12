import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useUploadImage } from "@/hooks/useUploadImage"

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function useEditProduct() {
  const router = useRouter()
  const params = useParams()
  const { uploadImage, uploading } = useUploadImage()

  const productId = Number(params.id)

  const [productName, setProductName] = useState("")
  const [productDescription, setProductDescription] = useState("")
  const [productPrice, setProductPrice] = useState("")
  const [productImage, setProductImage] = useState<File | null>(null)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [statusId, setStatusId] = useState<number>(1)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true)
        setLoadError("")

        if (!productId) {
          throw new Error("Producto no encontrado")
        }

        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .maybeSingle()

        if (error) throw error

        if (!data) {
          throw new Error("Producto no encontrado")
        }

        setProductName(data.product_name)
        setProductDescription(data.product_description || "")
        setProductPrice(String(data.product_price))
        setCurrentImageUrl(data.product_image)
        setCategoryId(data.category_id)
        setStatusId(data.status_id)

      } catch (err: unknown) {
        logger.error("Error cargando producto", err)
        setLoadError(getErrorMessage(err, "Error al cargar producto"))
      } finally {
        setLoading(false)
      }
    }

    loadProduct()
  }, [productId])

  async function updateProduct() {
    if (saving) return

    try {
      setSaving(true)
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

      let imageUrl = currentImageUrl

      if (productImage) {
        imageUrl = await uploadImage(
          productImage,
          process.env.NEXT_PUBLIC_CLOUDINARY_PRODUCTS_PRESET!
        )
      }

      const { error } = await supabase
        .from("products")
        .update({
          product_name: cleanName,
          product_description: productDescription.trim() || null,
          product_price: cleanPrice,
          product_image: imageUrl,
          category_id: categoryId,
          status_id: statusId
        })
        .eq("id", productId)

      if (error) throw error

      router.replace("/admin/products")
    } catch (err: unknown) {
      logger.error("Error actualizando producto", err)
      setError(getErrorMessage(err, "Error al guardar cambios"))
    } finally {
      setSaving(false)
    }
  }

  return {
    productName, setProductName,
    productDescription, setProductDescription,
    productPrice, setProductPrice,
    productImage, setProductImage,
    currentImageUrl,
    categoryId, setCategoryId,
    statusId, setStatusId,
    loading,
    saving: saving || uploading,
    loadError,
    error,
    updateProduct
  }
}