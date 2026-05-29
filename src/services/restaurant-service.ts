"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { z } from "zod"
import { requireCurrentAdmin } from "@/services/auth-guard"
import { ok, fail, type Result } from "@/services/result"
import { TEMPLATE_IDS } from "@/lib/menu/templates"

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/

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

const PrinterConfigSchema = z
  .object({
    device_name: z.string().max(80).optional(),
    ip: z.string().regex(IPV4, "IP inválida").optional(),
    port: z.number().int().min(1).max(65535).optional(),
    device_label: z.string().max(80).optional(),
  })
  .strict()

const UpdateOrderHandlingSchema = z
  .object({
    mode: z.enum(["waiter", "printer"]),
    connection_type: z.enum(["bluetooth", "network", "usb"]).nullable(),
    config: PrinterConfigSchema.default({}),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "printer") {
      if (!data.connection_type) {
        ctx.addIssue({ code: "custom", path: ["connection_type"], message: "Elegí el tipo de conexión" })
        return
      }
      if (data.connection_type === "network") {
        if (!data.config.ip) {
          ctx.addIssue({ code: "custom", path: ["config", "ip"], message: "Ingresá la IP de la impresora" })
        }
        if (!data.config.port) {
          ctx.addIssue({ code: "custom", path: ["config", "port"], message: "Ingresá el puerto (por lo general 9100)" })
        }
      }
    }
  })

export type UpdateOrderHandlingInput = z.infer<typeof UpdateOrderHandlingSchema>

export async function updateOrderHandling(
  input: UpdateOrderHandlingInput
): Promise<Result<null>> {
  const parsed = UpdateOrderHandlingSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos")
  }

  const auth = await requireCurrentAdmin()
  if (!auth.ok) return auth

  const { supabase, restaurantId } = auth.data
  const { mode, connection_type, config } = parsed.data

  const { error } = await supabase
    .from("restaurants")
    .update({
      order_handling_mode: mode,
      printer_connection_type: mode === "printer" ? connection_type : null,
      printer_config: mode === "printer" ? config : {},
    })
    .eq("id", restaurantId)

  if (error) return fail("No se pudo guardar los cambios")

  return ok(null)
}
