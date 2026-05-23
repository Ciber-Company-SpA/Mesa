import { createSupabaseServerClient } from "@/lib/supabase/server"
import { CreateProductSchema, type CreateProductInput } from "@/lib/validation/product"
import { ok, fail, type Result } from "@/services/result"

export type CreatedProduct = {
  id: number
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

  // 4. Si hay más de una opción, insertar variantes
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