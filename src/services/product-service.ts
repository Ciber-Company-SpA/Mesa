import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  CreateProductSchema,
  UpdateProductSchema,
  DeleteProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
  type DeleteProductInput,
} from "@/lib/validation/product"
import { ok, fail, type Result } from "@/services/result"

export type CreatedProduct = {
  id: number
}

export type ProductForEdit = {
  id: number
  name: string
  description: string | null
  categoryId: number
  variants: Array<{
    id: number
    name: string
    price: number
    imageUrl: string | null
    imagePublicId: string | null
  }>
  fallbackPrice: number
  fallbackImageUrl: string | null
  fallbackImagePublicId: string | null
}

export async function getProductForEdit(productId: number): Promise<Result<ProductForEdit>> {
  if (!productId || productId <= 0) {
    return fail("Producto no encontrado")
  }

  const supabase = await createSupabaseServerClient()

  const [productRes, variantsRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, product_name, product_description, product_price, product_image, product_image_public_id, category_id")
      .eq("id", productId)
      .maybeSingle(),
    supabase
      .from("product_variants")
      .select("id, variant_name, variant_price, variant_image, variant_image_public_id")
      .eq("product_id", productId)
      .order("created_at", { ascending: true }),
  ])

  if (productRes.error) return fail("Error al cargar producto")
  if (!productRes.data) return fail("Producto no encontrado")
  if (variantsRes.error) return fail("Error al cargar variantes")

  return ok({
    id: productRes.data.id,
    name: productRes.data.product_name,
    description: productRes.data.product_description,
    categoryId: productRes.data.category_id,
    fallbackPrice: productRes.data.product_price,
    fallbackImageUrl: productRes.data.product_image,
    fallbackImagePublicId: productRes.data.product_image_public_id,
    variants: (variantsRes.data ?? []).map((variant) => ({
      id: variant.id,
      name: variant.variant_name,
      price: variant.variant_price,
      imageUrl: variant.variant_image,
      imagePublicId: variant.variant_image_public_id,
    })),
  })
}

export async function createProduct(input: CreateProductInput): Promise<Result<CreatedProduct>> {
  const validation = CreateProductSchema.safeParse(input)

  if (!validation.success) {
    return fail(validation.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { name, description, categoryId, restaurantId, options } = validation.data

  const supabase = await createSupabaseServerClient()

  const coverIndex = Math.floor((options.length - 1) / 2)
  const coverOption = options[coverIndex]

  const { data: productData, error: productError } = await supabase
    .from("products")
    .insert({
      product_name: name,
      product_description: description,
      product_price: coverOption.price,
      product_image: coverOption.imageUrl,
      product_image_public_id: coverOption.imagePublicId,
      category_id: categoryId,
      restaurant_id: restaurantId,
      status_id: 1,
    })
    .select("id")
    .single()

  if (productError || !productData) {
    return fail("Error al crear el producto")
  }

  if (options.length > 1) {
    const { error: variantsError } = await supabase
      .from("product_variants")
      .insert(
        options.map((option) => ({
          product_id: productData.id,
          variant_name: option.name,
          variant_price: option.price,
          variant_image: option.imageUrl,
          variant_image_public_id: option.imagePublicId,
        }))
      )

    if (variantsError) {
      // El producto se creó pero las variantes no. Intentamos limpiar.
      await supabase.from("products").delete().eq("id", productData.id)
      return fail("Error al crear las variantes del producto")
    }
  }

  return ok({ id: productData.id })
}

export async function updateProduct(input: UpdateProductInput): Promise<Result<{ id: number }>> {
  const validation = UpdateProductSchema.safeParse(input)

  if (!validation.success) {
    return fail(validation.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { productId, name, description, categoryId, options, initialVariantIds } = validation.data

  const supabase = await createSupabaseServerClient()

  // 1. Calcular opción de portada
  const coverIndex = Math.floor((options.length - 1) / 2)
  const coverOption = options[coverIndex]

  // 2. UPDATE del producto
  const { error: productError } = await supabase
    .from("products")
    .update({
      product_name: name,
      product_description: description,
      product_price: coverOption.price,
      product_image: coverOption.imageUrl,
      product_image_public_id: coverOption.imagePublicId,
      category_id: categoryId,
    })
    .eq("id", productId)

  if (productError) return fail("Error al actualizar producto")

  // 3. Sincronizar variantes
  if (options.length === 1) {
    // Producto simple: borrar todas las variantes existentes
    const { error: deleteError } = await supabase
      .from("product_variants")
      .delete()
      .eq("product_id", productId)

    if (deleteError) return fail("Error al eliminar variantes antiguas")
  } else {
    // Producto con variantes: insert/update/delete según corresponda
    const currentVariantIds = options
      .map((option) => option.variantId)
      .filter((variantId): variantId is number => Boolean(variantId))

    const removedVariantIds = initialVariantIds.filter(
      (variantId) => !currentVariantIds.includes(variantId)
    )

    // Borrar las variantes que el user eliminó
    if (removedVariantIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("product_variants")
        .delete()
        .in("id", removedVariantIds)

      if (deleteError) return fail("Error al eliminar variantes")
    }

    // Insert/Update de cada opción restante
    for (const option of options) {
      if (option.variantId) {
        // Variante existente: UPDATE
        const { error: updateError } = await supabase
          .from("product_variants")
          .update({
            variant_name: option.name,
            variant_price: option.price,
            variant_image: option.imageUrl,
            variant_image_public_id: option.imagePublicId,
          })
          .eq("id", option.variantId)

        if (updateError) return fail("Error al actualizar variante")
      } else {
        // Variante nueva: INSERT
        const { error: insertError } = await supabase
          .from("product_variants")
          .insert({
            product_id: productId,
            variant_name: option.name,
            variant_price: option.price,
            variant_image: option.imageUrl,
            variant_image_public_id: option.imagePublicId,
          })

        if (insertError) return fail("Error al insertar nueva variante")
      }
    }
  }

  return ok({ id: productId })
}

export async function deleteProduct(input: DeleteProductInput): Promise<Result<{ id: number }>> {
  const validation = DeleteProductSchema.safeParse(input)

  if (!validation.success) {
    return fail(validation.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { productId } = validation.data

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)

  if (error) {
    return fail("Error al eliminar el producto")
  }

  return ok({ id: productId })
}