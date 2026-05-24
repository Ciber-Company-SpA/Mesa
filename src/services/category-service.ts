import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  DeleteCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type DeleteCategoryInput,
} from "@/lib/validation/category"
import { ok, fail, type Result } from "@/services/result"

export type CreatedCategory = {
  id: number
}

export type CategoryForEdit = {
  id: number
  name: string
}

export async function getCategoryForEdit(categoryId: number): Promise<Result<CategoryForEdit>> {
  if (!categoryId || categoryId <= 0) {
    return fail("Categoría no encontrada")
  }

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("categories")
    .select("id, category_name")
    .eq("id", categoryId)
    .maybeSingle()

  if (error) return fail("Error al cargar categoría")
  if (!data) return fail("Categoría no encontrada")

  return ok({
    id: data.id,
    name: data.category_name,
  })
}

export async function createCategory(input: CreateCategoryInput): Promise<Result<CreatedCategory>> {
  const validation = CreateCategorySchema.safeParse(input)

  if (!validation.success) {
    return fail(validation.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { name, restaurantId } = validation.data

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("categories")
    .insert({
      category_name: name,
      restaurant_id: restaurantId,
    })
    .select("id")
    .single()

  if (error || !data) {
    return fail("Error al crear la categoría")
  }

  return ok({ id: data.id })
}

export async function updateCategory(input: UpdateCategoryInput): Promise<Result<{ id: number }>> {
  const validation = UpdateCategorySchema.safeParse(input)

  if (!validation.success) {
    return fail(validation.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { categoryId, name } = validation.data

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from("categories")
    .update({ category_name: name })
    .eq("id", categoryId)

  if (error) {
    return fail("Error al actualizar la categoría")
  }

  return ok({ id: categoryId })
}

export async function deleteCategory(input: DeleteCategoryInput): Promise<Result<{ id: number }>> {
  const validation = DeleteCategorySchema.safeParse(input)

  if (!validation.success) {
    return fail(validation.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { categoryId } = validation.data

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId)

  if (error) {
    return fail("Error al eliminar la categoría")
  }

  return ok({ id: categoryId })
}