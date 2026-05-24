import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  CreateVariantSchema,
  UpdateVariantSchema,
  DeleteVariantSchema,
  type CreateVariantInput,
  type UpdateVariantInput,
  type DeleteVariantInput,
} from "@/lib/validation/variant"
import { ok, fail, type Result } from "@/services/result"

export type CreatedVariant = {
  id: number
}

export async function createVariant(input: CreateVariantInput): Promise<Result<CreatedVariant>> {
  const validation = CreateVariantSchema.safeParse(input)

  if (!validation.success) {
    return fail(validation.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { productId, name, price, imageUrl, imagePublicId } = validation.data

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("product_variants")
    .insert({
      product_id: productId,
      variant_name: name,
      variant_price: price,
      variant_image: imageUrl,
      variant_image_public_id: imagePublicId,
    })
    .select("id")
    .single()

  if (error || !data) {
    return fail("Error al crear la variante")
  }

  return ok({ id: data.id })
}

export async function updateVariant(input: UpdateVariantInput): Promise<Result<{ id: number }>> {
  const validation = UpdateVariantSchema.safeParse(input)

  if (!validation.success) {
    return fail(validation.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { variantId, name, price, imageUrl, imagePublicId } = validation.data

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from("product_variants")
    .update({
      variant_name: name,
      variant_price: price,
      variant_image: imageUrl,
      variant_image_public_id: imagePublicId,
    })
    .eq("id", variantId)

  if (error) {
    return fail("Error al actualizar la variante")
  }

  return ok({ id: variantId })
}

export async function deleteVariant(input: DeleteVariantInput): Promise<Result<{ id: number }>> {
  const validation = DeleteVariantSchema.safeParse(input)

  if (!validation.success) {
    return fail(validation.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { variantId } = validation.data

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from("product_variants")
    .delete()
    .eq("id", variantId)

  if (error) {
    return fail("Error al eliminar la variante")
  }

  return ok({ id: variantId })
}