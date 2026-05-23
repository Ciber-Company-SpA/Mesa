import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { decodeId } from "@/lib/hashids"
import { supabase } from "@/lib/supabase"
import { revalidateMenu } from "@/app/actions/revalidate-menu"
import { logger } from "@/lib/logger"
import { getSafeErrorMessage } from "@/lib/safe-error"
import { useUploadImage } from "@/hooks/useUploadImage"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"
import type { ProductOptionForm } from "@/types/product-option-form"
import type { ProductVariant } from "@/types/product-variant"

const safeErrors = [
  "Producto no encontrado",
  "El nombre del producto es obligatorio",
  "El precio debe ser mayor a 0",
  "El precio de cada opcion debe ser mayor a 0",
  "El nombre de cada opcion es obligatorio",
  "Debes seleccionar una categoria"
]

type PreparedOption = {
  variantId?: number
  name: string
  price: number
  imageUrl: string | null
  imagePublicId: string | null
}

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

function getCoverOptionIndex(optionsLength: number) {
  return Math.floor((optionsLength - 1) / 2)
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
  const { run: loadProductWithRetry, isPending: isLoadPending } = useOfflineRetry(async () => {
    if (!productId) throw new Error("Producto no encontrado")

    const [productRes, variantsRes] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .maybeSingle(),
      supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: true }),
    ])

    if (productRes.error) throw productRes.error
    if (!productRes.data) throw new Error("Producto no encontrado")
    if (variantsRes.error) throw variantsRes.error

    const variants = (variantsRes.data ?? []) as ProductVariant[]

    setProductName(productRes.data.product_name)
    setProductDescription(productRes.data.product_description || "")
    setCategoryId(productRes.data.category_id)
    setInitialVariantIds(variants.map((variant) => variant.id))

    if (variants.length > 0) {
      setOptions(
        variants.map((variant) =>
          createLocalOption({
            variantId: variant.id,
            name: variant.variant_name,
            price: String(variant.variant_price),
            imageUrl: variant.variant_image,
            imagePublicId: variant.variant_image_public_id,
          })
        )
      )
    } else {
      setOptions([
        createLocalOption({
          name: "Principal",
          price: String(productRes.data.product_price),
          imageUrl: productRes.data.product_image,
          imagePublicId: productRes.data.product_image_public_id,
        })
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
        if (isNetworkError(err)) return
        logger.error("Error cargando producto", err)
        setLoadError(getSafeErrorMessage(err, "Error al cargar producto", safeErrors))
      } finally {
        setLoading(false)
      }
    }

    loadProduct()
  }, [loadProductWithRetry])

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
        createLocalOption({ name: `Opcion ${normalizedOptions.length + 1}` })
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
        variantId: option.variantId,
        name: cleanName || "Principal",
        price: cleanPrice,
        imageUrl,
        imagePublicId,
      })
    }

    return preparedOptions
  }

  const { run: updateProductWithRetry, isPending } = useOfflineRetry(async () => {
    if (!productId) throw new Error("Producto no encontrado")

    const cleanName = productName.trim()

    if (!cleanName) throw new Error("El nombre del producto es obligatorio")
    if (!categoryId) throw new Error("Debes seleccionar una categoria")

    const preparedOptions = await prepareOptions()
    const coverOption = preparedOptions[getCoverOptionIndex(preparedOptions.length)]

    const { error: productError } = await supabase
      .from("products")
      .update({
        product_name: cleanName,
        product_description: productDescription.trim() || null,
        product_price: coverOption.price,
        product_image: coverOption.imageUrl,
        product_image_public_id: coverOption.imagePublicId,
        category_id: categoryId
      })
      .eq("id", productId)

    if (productError) throw productError

    if (preparedOptions.length === 1) {
      const { error: deleteVariantsError } = await supabase
        .from("product_variants")
        .delete()
        .eq("product_id", productId)

      if (deleteVariantsError) throw deleteVariantsError
    } else {
      const currentVariantIds = preparedOptions
        .map((option) => option.variantId)
        .filter((variantId): variantId is number => Boolean(variantId))
      const removedVariantIds = initialVariantIds.filter(
        (variantId) => !currentVariantIds.includes(variantId)
      )

      if (removedVariantIds.length > 0) {
        const { error: deleteRemovedError } = await supabase
          .from("product_variants")
          .delete()
          .in("id", removedVariantIds)

        if (deleteRemovedError) throw deleteRemovedError
      }

      for (const option of preparedOptions) {
        if (option.variantId) {
          const { error: updateVariantError } = await supabase
            .from("product_variants")
            .update({
              variant_name: option.name,
              variant_price: option.price,
              variant_image: option.imageUrl,
              variant_image_public_id: option.imagePublicId,
            })
            .eq("id", option.variantId)

          if (updateVariantError) throw updateVariantError
        } else {
          const { error: insertVariantError } = await supabase
            .from("product_variants")
            .insert({
              product_id: productId,
              variant_name: option.name,
              variant_price: option.price,
              variant_image: option.imageUrl,
              variant_image_public_id: option.imagePublicId,
            })

          if (insertVariantError) throw insertVariantError
        }
      }
    }

    await revalidateMenu()

    router.replace("/admin/products")
  })

  async function updateProduct() {
    if (saving) return

    try {
      setSaving(true)
      setError("")

      await updateProductWithRetry()
    } catch (err: unknown) {
      if (isNetworkError(err)) return
      logger.error("Error actualizando producto", err)
      setError(getSafeErrorMessage(err, "Error al guardar cambios", safeErrors))
    } finally {
      setSaving(false)
    }
  }

  return {
    productId,
    productName, setProductName,
    productDescription, setProductDescription,
    productPrice, setProductPrice,
    productImage, setProductImage,
    currentImageUrl,
    categoryId, setCategoryId,
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
    updateProduct
  }
}
