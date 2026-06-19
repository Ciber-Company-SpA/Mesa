"use server"

import { z } from "zod"
import { sendLeadEmail } from "@/lib/email/send-lead-email"
import { ok, fail, type Result } from "@/services/result"

const LeadSchema = z.object({
  nombre: z.string().trim().min(1, "Falta tu nombre").max(100),
  local: z.string().trim().min(1, "Falta el nombre del local").max(120),
  contacto: z.string().trim().min(3, "Falta un correo o teléfono de contacto").max(150),
  telefono: z.string().trim().max(60).optional(),
  negocio: z.string().trim().max(80).optional(),
  ciudad: z.string().trim().max(80).optional(),
  mensaje: z.string().trim().max(1000).optional(),
  plan: z.string().trim().max(60).optional(),
})

export type LeadActionInput = z.infer<typeof LeadSchema>

export async function submitLead(input: LeadActionInput): Promise<Result<null>> {
  const parsed = LeadSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos")
  }

  const res = await sendLeadEmail(parsed.data)
  if (!res.sent) {
    return fail("No se pudo enviar la solicitud. Intenta de nuevo o escríbenos directo.")
  }
  return ok(null)
}
