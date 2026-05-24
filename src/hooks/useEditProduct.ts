import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { decodeId } from "@/lib/hashids"
import { useUploadImage } from "@/hooks/useUploadImage"
import { useOfflineRetry } from "@/hooks/useOfflineRetry"
import { handleMutationError } from "@/lib/hooks/handle-mutation-error"
import {
  updateProductAction,
  getProductForEditAction,
} from "@/app/actions/product-actions"
import {
  UpdateProductOptionSchema,
  UpdateProductSchema,
  type UpdateProductOptionInput,
  type ProductOptionForm,
} from "@/lib/validation/product"

let optionIdSeed = 0

function createLocalOption(values?: Partial<ProductOptionForm>): ProductOptionForm {
  optionIdSeed += 1

  return {
    localId: `option-${Date.now()}-${optionIdSeed}`,
    name: "",
    price: "",
    imageFile: null,
    imageUrl: null,
    imagePublicId: null,
    ...values,
  }
}

export function useEditProduct() {
  const router = useRouter()
  const params = useParams()
  const { uploadImage, uploading } = useUploadImage()

  const productId = decodeId(params.id as string)

  const [productName, setProductName] = useState("")
  const [productDescription, setProductDescription] = useState("")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [options, setOptions] = useState<ProductOptionForm[]>([createLocalOption()])
  const [initialVariantIds, setInitialVariantIds] = useState<number[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [error, setError] = useState("")

  const productPrice = options[0]?.price ?? ""
  const productImage = options[0]?.imageFile ?? null
  const currentImageUrl = options[0]?.imageUrl ?? null

  // ============ CARGAR PRODUCTO ============

  const { run: loadProductWithRetry, isPending: isLoadPending } = useOfflineRetry(async () => {
    if (!productId) throw new Error("Producto no encontrado")

    const result = await getProductForEditAction(productId)

    if (!result.ok) {
      throw new Error(result.error)
    }

    const product = result.data

    setProductName(product.name)
    setProductDescription(product.description ?? "")
    setCategoryId(product.categoryId)
    setInitialVariantIds(product.variants.map((variant) => variant.id))

    if (product.variants.length > 0) {
      setOptions(
        product.variants.map((variant) =>
          createLocalOption({
            variantId: variant.id,
            name: variant.name,
            price: String(variant.price),
            imageUrl: variant.imageUrl,
            imagePublicId: variant.imagePublicId,
          })
        )
      )
    } else {
      setOptions([
        createLocalOption({
          name: "Principal",
          price: String(product.fallbackPrice),
          imageUrl: product.fallbackImageUrl,
          imagePublicId: product.fallbackImagePublicId,
        }),
      ])
    }

    setLoadError("")
  })

  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true)
        setLoadError("")
        await loadProductWithRetry()
      } catch (err: unknown) {
        handleMutationError(err, {
          logTag: "Error cargando producto",
          fallback: "Error al cargar producto",
          setError: setLoadError,
        })
      } finally {
        setLoading(false)
      }
    }

    loadProduct()
  }, [loadProductWithRetry])

  // ============ FORM HELPERS ============

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
        createLocalOption({ name: `Opcion ${normalizedOptions.length + 1}` }),
      ]
    })
  }

  function removeOption(localId: string) {
    setOptions((currentOptions) => {
      if (currentOptions.length === 1) return currentOptions
      return currentOptions.filter((option) => option.localId !== localId)
    })
  }

  // ============ PREPARAR OPCIONES (subir imágenes + validar) ============

  async function prepareOptions(): Promise<UpdateProductOptionInput[]> {
    const preparedOptions: UpdateProductOptionInput[] = []

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
        ...(option.variantId ? { variantId: option.variantId } : {}),
        name: option.name.trim() || "Principal",
        price: Number(option.price),
        imageUrl,
        imagePublicId,
      }

      const validation = UpdateProductOptionSchema.safeParse(rawOption)

      if (!validation.success) {
        throw new Error(validation.error.issues[0]?.message ?? "Datos inválidos")
      }

      preparedOptions.push(validation.data)
    }

    return preparedOptions
  }

  // ============ ACTUALIZAR ============

  const { run: updateProductWithRetry, isPending } = useOfflineRetry(async () => {
    if (!productId) throw new Error("Producto no encontrado")

    // Validar form básico antes de subir imágenes
    const basicValidation = UpdateProductSchema.safeParse({
      productId,
      name: productName.trim(),
      description: productDescription.trim() || null,
      categoryId,
      options: [{ name: "placeholder", price: 1, imageUrl: null, imagePublicId: null }],
      initialVariantIds,
    })

    if (!basicValidation.success) {
      const firstError = basicValidation.error.issues.find((issue) => issue.path[0] !== "options")
      if (firstError) throw new Error(firstError.message)
    }

    // Subir imágenes + validar options
    const preparedOptions = await prepareOptions()

    // Llamar al server
    const result = await updateProductAction({
      productId,
      name: productName.trim(),
      description: productDescription.trim() || null,
      categoryId: categoryId!,
      options: preparedOptions,
      initialVariantIds,
    })

    if (!result.ok) {
      throw new Error(result.error)
    }

    router.replace("/admin/products")
  })

  async function updateProduct() {
    if (saving) return

    try {
      setSaving(true)
      setError("")
      await updateProductWithRetry()
    } catch (err: unknown) {
      handleMutationError(err, {
        logTag: "Error actualizando producto",
        fallback: "Error al guardar cambios",
        setError,
      })
    } finally {
      setSaving(false)
    }
  }

  return {
    productId,
    productName,
    setProductName,
    productDescription,
    setProductDescription,
    productPrice,
    setProductPrice,
    productImage,
    setProductImage,
    currentImageUrl,
    categoryId,
    setCategoryId,
    options,
    setOptionName,
    setOptionPrice,
    setOptionImage,
    addOption,
    removeOption,
    loading: loading || isLoadPending,
    saving: saving || uploading || isPending,
    loadError,
    error,
    updateProduct,
  }
}