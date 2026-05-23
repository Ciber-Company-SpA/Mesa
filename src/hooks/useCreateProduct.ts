import { useState } from "react"
import { useRouter } from "next/navigation"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { useUploadImage } from "@/hooks/useUploadImage"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"
import { createProductAction } from "@/app/actions/product-actions"
import { ProductOptionSchema, CreateProductSchema, type ProductOptionInput } from "@/lib/validation/product"
import type { ProductOptionForm } from "@/types/product-option-form"

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

  // Sube imágenes pendientes y construye los options con URLs ya subidas
  async function prepareOptions(): Promise<ProductOptionInput[]> {
    const preparedOptions: ProductOptionInput[] = []

    for (const option of options) {
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

      const rawOption = {
        name: option.name.trim() || "Principal",
        price: Number(option.price),
        imageUrl,
        imagePublicId,
      }

      // Validar cliente con Zod
      const validation = ProductOptionSchema.safeParse(rawOption)

      if (!validation.success) {
        throw new Error(validation.error.issues[0]?.message ?? "Datos inválidos")
      }

      preparedOptions.push(validation.data)
    }

    return preparedOptions
  }

  const { run: createProductWithRetry, isPending } = useOfflineRetry(async () => {
    if (!restaurantId) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw { isNetworkError: true, message: "Sin conexion" }
      }
      throw new Error("No se encontro el restaurante")
    }

    // Validar el form completo en cliente antes de subir nada
    const formValidation = CreateProductSchema.safeParse({
      name: productName.trim(),
      description: productDescription.trim() || null,
      categoryId,
      restaurantId,
      // options se valida después en prepareOptions
      options: [{ name: "placeholder", price: 1, imageUrl: null, imagePublicId: null }],
    })

    // Solo validamos los campos top-level, no options aún (porque hay que subir imágenes primero)
    if (!formValidation.success) {
      const firstError = formValidation.error.issues.find((issue) => issue.path[0] !== "options")
      if (firstError) throw new Error(firstError.message)
    }

    // Subir imágenes + validar options
    const preparedOptions = await prepareOptions()

    // Llamar al server
    const result = await createProductAction({
      name: productName.trim(),
      description: productDescription.trim() || null,
      categoryId: categoryId!,
      restaurantId,
      options: preparedOptions,
    })

    if (!result.ok) {
      throw new Error(result.error)
    }

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
      setError(err instanceof Error ? err.message : "Error al crear producto")
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
    createProduct,
  }
}