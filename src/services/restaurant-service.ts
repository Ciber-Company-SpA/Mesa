"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { z } from "zod"
import { requireCurrentAdmin } from "@/services/auth-guard"
import { ok, fail, type Result } from "@/services/result"
import { TEMPLATE_IDS } from "@/lib/menu/templates"

const UpdateMenuTemplateSchema = z.object({
  template: z.enum(TEMPLATE_IDS),
})

export type UpdateMenuTemplateInput = z.infer<typeof UpdateMenuTemplateSchema>

export async function updateMenuTemplate(
  input: UpdateMenuTemplateInput
): Promise<Result<null>> {
  const parsed = UpdateMenuTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos")
  }

  const auth = await requireCurrentAdmin()
  if (!auth.ok) return auth

  const { supabase, restaurantId } = auth.data

  const { error } = await supabase
    .from("restaurants")
    .update({ menu_template: parsed.data.template })
    .eq("id", restaurantId)

  if (error) return fail("No se pudo guardar los cambios")

  revalidateTag("menu", "max")
  revalidatePath("/[id]/menu", "page")
  return ok(null)
}

const UpdateRestaurantNameSchema = z.object({
  name: z.string().trim().min(1, "El nombre no puede estar vacío").max(60, "Máximo 60 caracteres"),
})

export type UpdateRestaurantNameInput = z.infer<typeof UpdateRestaurantNameSchema>

export async function updateRestaurantName(
  input: UpdateRestaurantNameInput
): Promise<Result<null>> {
  const parsed = UpdateRestaurantNameSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos")
  }

  const auth = await requireCurrentAdmin()
  if (!auth.ok) return auth

  const { supabase, restaurantId } = auth.data

  const { error } = await supabase
    .from("restaurants")
    .update({ restaurant_name: parsed.data.name })
    .eq("id", restaurantId)

  if (error) return fail("No se pudo guardar los cambios")

  revalidateTag("menu", "max")
  revalidatePath("/[id]/menu", "page")
  return ok(null)
}
