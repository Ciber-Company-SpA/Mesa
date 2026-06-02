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

const UpdateOrderDestinationSchema = z.object({
  destination: z.enum(["waiter", "kitchen"]),
})

export type UpdateOrderDestinationInput = z.infer<typeof UpdateOrderDestinationSchema>

export async function updateOrderDestination(
  input: UpdateOrderDestinationInput
): Promise<Result<null>> {
  const parsed = UpdateOrderDestinationSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos")
  }

  const auth = await requireCurrentAdmin()
  if (!auth.ok) return auth

  const { supabase, restaurantId } = auth.data

  const { error } = await supabase
    .from("restaurants")
    .update({ order_destination: parsed.data.destination })
    .eq("id", restaurantId)

  if (error) return fail("No se pudo guardar los cambios")

  return ok(null)
}

const UpdateOutputModeSchema = z.object({
  mode: z.enum(["none", "printer", "screen"]),
  bluetoothName: z
    .string()
    .trim()
    .max(80, "Máximo 80 caracteres")
    .optional()
    .nullable(),
})

export type UpdateOutputModeInput = z.infer<typeof UpdateOutputModeSchema>

export async function updateOutputMode(
  input: UpdateOutputModeInput
): Promise<Result<null>> {
  const parsed = UpdateOutputModeSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos")
  }

  const auth = await requireCurrentAdmin()
  if (!auth.ok) return auth

  const { supabase, restaurantId } = auth.data
  const { mode, bluetoothName } = parsed.data

  const { error } = await supabase
    .from("restaurants")
    .update({
      output_mode: mode,
      printer_bluetooth_name: mode === "printer" ? (bluetoothName?.trim() || null) : null,
    })
    .eq("id", restaurantId)

  if (error) return fail("No se pudo guardar los cambios")

  return ok(null)
}

const UpdateRestaurantNameSchema = z.object({
  name: z.string().trim().min(1, "El nombre no puede estar vacío").max(60, "Máximo 60 caracteres"),
})

const UpdateRestaurantCitySchema = z.object({
  city: z.string().trim().max(80, "Máximo 80 caracteres").nullable(),
})

export type UpdateRestaurantCityInput = z.infer<typeof UpdateRestaurantCitySchema>

export async function updateRestaurantCity(
  input: UpdateRestaurantCityInput
): Promise<Result<null>> {
  const parsed = UpdateRestaurantCitySchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos")
  }

  const auth = await requireCurrentAdmin()
  if (!auth.ok) return auth

  const { supabase, restaurantId } = auth.data

  const { error } = await supabase
    .from("restaurants")
    .update({ restaurant_city: parsed.data.city?.trim() || null })
    .eq("id", restaurantId)

  if (error) return fail("No se pudo guardar los cambios")

  return ok(null)
}

const CompleteOnboardingSchema = z.object({
  restaurantName: z.string().trim().min(1, "El nombre del restaurante no puede estar vacío").max(60, "Máximo 60 caracteres"),
  adminName: z.string().trim().min(1, "Tu nombre no puede estar vacío").max(60, "Máximo 60 caracteres"),
})

export type CompleteOnboardingInput = z.infer<typeof CompleteOnboardingSchema>

export async function completeOnboarding(
  input: CompleteOnboardingInput
): Promise<Result<null>> {
  const parsed = CompleteOnboardingSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos")
  }

  const auth = await requireCurrentAdmin()
  if (!auth.ok) return auth

  const { supabase, restaurantId } = auth.data

  const [restaurantRes, userRes] = await Promise.all([
    supabase
      .from("restaurants")
      .update({ restaurant_name: parsed.data.restaurantName })
      .eq("id", restaurantId),
    supabase.rpc("update_own_user_name", { p_user_name: parsed.data.adminName }),
  ])

  if (restaurantRes.error || userRes.error) {
    return fail("No se pudo completar la configuración inicial")
  }

  revalidateTag("menu", "max")
  revalidatePath("/[id]/menu", "page")
  return ok(null)
}

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
