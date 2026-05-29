"use server"

import { revalidateTag } from "next/cache"
import { z } from "zod"
import { requireCurrentAdmin } from "@/services/auth-guard"
import { ok, fail, type Result } from "@/services/result"

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const UpdateMenuHeaderStyleSchema = z
  .object({
    type: z.enum(["solid", "gradient"]),
    color1: z.string().regex(HEX_COLOR, "Color inválido"),
    color2: z
      .string()
      .regex(HEX_COLOR, "Color inválido")
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "gradient" && !data.color2) {
      ctx.addIssue({
        code: "custom",
        path: ["color2"],
        message: "Se requiere un segundo color para el gradiente",
      })
    }
  })

export type UpdateMenuHeaderStyleInput = z.infer<typeof UpdateMenuHeaderStyleSchema>

export async function updateMenuHeaderStyle(
  input: UpdateMenuHeaderStyleInput
): Promise<Result<null>> {
  const parsed = UpdateMenuHeaderStyleSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos")
  }

  const auth = await requireCurrentAdmin()
  if (!auth.ok) return auth

  const { supabase, restaurantId } = auth.data
  const { type, color1, color2 } = parsed.data

  const { error } = await supabase
    .from("restaurants")
    .update({
      menu_header_type: type,
      menu_header_color_1: color1,
      menu_header_color_2: type === "gradient" ? color2 : null,
    })
    .eq("id", restaurantId)

  if (error) return fail("No se pudo guardar los cambios")

  revalidateTag("menu", "max")
  return ok(null)
}
