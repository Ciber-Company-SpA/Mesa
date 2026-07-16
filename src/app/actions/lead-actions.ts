"use server"

import { z } from "zod"
import { createSupabaseAnonClient } from "@/lib/supabase/anon"
import { sendLeadEmail } from "@/lib/email/send-lead-email"
import { checkLeadLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
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
  const d = parsed.data

  // Anti-spam por IP.
  try {
    const { success } = await checkLeadLimit()
    if (!success) {
      return fail("Recibimos varias solicitudes seguidas. Esperá un momento e intentá de nuevo.")
    }
  } catch (err) {
    // Fail-open: si el limitador no responde, no bloqueamos la captación del lead.
    logger.error("Rate limit no disponible en submitLead", err)
  }

  // Fuente de verdad: el lead queda registrado en el módulo Leads del portal.
  const supabase = createSupabaseAnonClient()
  const { error } = await supabase.rpc("submit_lead", {
    p_name: d.nombre,
    p_business_name: d.local,
    p_email: d.contacto,
    p_phone: d.telefono ?? null,
    p_business_type: d.negocio ?? null,
    p_city: d.ciudad ?? null,
    p_message: d.mensaje ?? null,
    p_plan_interest: d.plan ?? null,
  })
  if (error) {
    logger.error("No se pudo registrar el lead", error)
    return fail("No se pudo enviar la solicitud. Intenta de nuevo o escríbenos directo.")
  }

  // Notificación por correo: best-effort, no bloquea (el lead ya quedó guardado).
  try {
    await sendLeadEmail(d)
  } catch (err) {
    logger.error("Lead guardado pero falló el correo de aviso", err)
  }

  return ok(null)
}
