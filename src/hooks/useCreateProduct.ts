import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { revalidateMenu } from "@/app/actions/revalidate-menu"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useUploadImage } from "@/hooks/useUploadImage"
import { getSafeErrorMessage } from "@/lib/safe-error"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"
import type { ProductOptionForm } from "@/types/product-option-form"
import type { PreparedOption } from "@/types/prepared-option"

const safeErrors = [
  "El nombre del producto es obligatorio",
  "El precio debe ser mayor a 0",
  "El precio de cada opcion debe ser mayor a 0",
  "El nombre de cada opcion es obligatorio",
  "Debes seleccionar una categoria",
  "No se encontro el restaurante"
]



let optionIdSeed = 0

function createLocalOption(name = ""): ProductOptionForm {
  optionIdSeed += 1

  return {
    localId: `option-${Date.now()}-${optionIdSeed}`,
    name,
    price: "",
    imageFile: null,
    imageUrl: null,
    imagePublicId: null,
  }
}

function getCoverOptionIndex(optionsLength: number) {
  return Math.floor((optionsLength - 1) / 2)
}

export function useCreateProduct() {
  const router = useRouter()
  const { restaurantId, loading: loadingId } = useRestaurantId()
  const { uploadImage, uploading } = useUploadImage()

  const [productName, setProductName] = useState("")
  const [productDescription, setProductDescription] = useState("")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [options, setOptions] = useState<ProductOptionForm[]>([createLocalOption()])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const productPrice = options[0]?.price ?? ""
  const productImage = options[0]?.imageFile ?? null
  function updateOption(localId: string, patch: Partial<ProductOptionForm>) {
    setOptions((currentOptions) =>
      currentOptions.map((option) =>
        option.localId === localId ? { ...option, ...patch } : option
      )
    )
  }

  function setProductPrice(value: string) {
    const firstOption = options[0]
    if (!firstOption) return

    updateOption(firstOption.localId, { price: value })
  }

  function setProductImage(file: File | null) {
    const firstOption = options[0]
    if (!firstOption) return

    updateOption(firstOption.localId, { imageFile: file })
  }

  function setOptionName(localId: string, value: string) {
    updateOption(localId, { name: value })
  }

  function setOptionPrice(localId: string, value: string) {
    updateOption(localId, { price: value })
  }

  function setOptionImage(localId: string, file: File | null) {
    updateOption(localId, { imageFile: file })
  }

  function addOption() {
    setOptions((currentOptions) => {
      const normalizedOptions =
        currentOptions.length === 1 && !currentOptions[0]?.name.trim()
          ? [{ ...currentOptions[0], name: "Opcion 1" }]
          : currentOptions

      return [
        ...normalizedOptions,
        createLocalOption(`Opcion ${normalizedOptions.length + 1}`)
      ]
    })
  }

  function removeOption(localId: string) {
    setOptions((currentOptions) => {
      if (currentOptions.length === 1) return currentOptions
      return currentOptions.filter((option) => option.localId !== localId)
    })
  }

  async function prepareOptions() {
    const isVariantMode = options.length > 1
    const preparedOptions: PreparedOption[] = []

    for (const option of options) {
      const cleanName = option.name.trim()
      const cleanPrice = Number(option.price)

      if (!cleanPrice || cleanPrice <= 0) {
        throw new Error(
          isVariantMode
            ? "El precio de cada opcion debe ser mayor a 0"
            : "El precio debe ser mayor a 0"
        )
      }

      if (isVariantMode && !cleanName) {
        throw new Error("El nombre de cada opcion es obligatorio")
      }

      let imageUrl = option.imageUrl
      let imagePublicId = option.imagePublicId

      if (option.imageFile) {
        const result = await uploadImage(
          option.imageFile,
          process.env.NEXT_PUBLIC_CLOUDINARY_PRODUCTS_PRESET!
        )

        if (!result) throw new Error("Error al subir imagen")

        imageUrl = result.secure_url
        imagePublicId = result.public_id
      }

      preparedOptions.push({
        name: cleanName || "Principal",
        price: cleanPrice,
        imageUrl,
        imagePublicId,
      })
    }

    return preparedOptions
  }

  const { run: createProductWithRetry, isPending } = useOfflineRetry(async () => {
    const cleanName = productName.trim()

    if (!cleanName) throw new Error("El nombre del producto es obligatorio")
    if (!categoryId) throw new Error("Debes seleccionar una categoria")

    if (!restaurantId) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw { isNetworkError: true, message: "Sin conexion" }
      }

      throw new Error("No se encontro el restaurante")
    }

    const preparedOptions = await prepareOptions()
    const coverOption = preparedOptions[getCoverOptionIndex(preparedOptions.length)]

    const { data: productData, error: productError } = await supabase
      .from("products")
      .insert({
        product_name: cleanName,
        product_description: productDescription.trim() || null,
        product_price: coverOption.price,
        product_image: coverOption.imageUrl,
        product_image_public_id: coverOption.imagePublicId,
        category_id: categoryId,
        restaurant_id: restaurantId,
        status_id: 1
      })
      .select("id")
      .single()

    if (productError) throw productError

    if (preparedOptions.length > 1) {
      const { error: variantsError } = await supabase
        .from("product_variants")
        .insert(
          preparedOptions.map((option) => ({
            product_id: productData.id,
            variant_name: option.name,
            variant_price: option.price,
            variant_image: option.imageUrl,
            variant_image_public_id: option.imagePublicId,
          }))
        )

      if (variantsError) throw variantsError
    }

    await revalidateMenu()

    router.replace("/admin/products")
  })

  async function createProduct() {
    if (loading || loadingId) return

    try {
      setLoading(true)
      setError("")

      await createProductWithRetry()
    } catch (err: unknown) {
      if (isNetworkError(err)) return
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
    options,
    setOptionName,
    setOptionPrice,
    setOptionImage,
    addOption,
    removeOption,
    loading: loading || uploading || isPending,
    error,
    createProduct
  }
}
