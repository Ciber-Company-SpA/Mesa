import "server-only"
import { Resend } from "resend"
import { logger } from "@/lib/logger"

export type LeadInput = {
  nombre: string
  local: string
  contacto: string
  telefono?: string
  negocio?: string
  ciudad?: string
  mensaje?: string
  plan?: string
}

/**
 * Envía la solicitud (demo o plan) del sitio público a SUPPORT_MAIL vía Resend.
 * El "from" es el dominio verificado (RESEND_FROM_EMAIL) y el reply-to es el
 * correo del prospecto para responderle directo.
 */
export async function sendLeadEmail(input: LeadInput): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"
  const to = process.env.SUPPORT_MAIL

  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY no configurada" }
  if (!to) return { sent: false, reason: "SUPPORT_MAIL no configurada" }

  const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contacto) ? input.contacto : undefined
  const subject = input.plan
    ? `Solicitud de ${input.plan} — ${input.local}`
    : `Nueva solicitud de demo — ${input.local}`

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: `MESA Web <${fromEmail}>`,
      to,
      replyTo,
      subject,
      html: buildHtml(input),
    })
    if (error) {
      logger.warn("Resend rechazó el envío del lead", { error: String(error) })
      return { sent: false, reason: error.message ?? "Error desconocido" }
    }
    return { sent: true }
  } catch (err) {
    logger.warn("Error enviando lead por correo", { err: String(err) })
    return { sent: false, reason: String(err) }
  }
}

function row(label: string, value?: string): string {
  if (!value) return ""
  return `<tr>
    <td style="padding:8px 12px;color:#6B7280;font-size:13px;font-weight:600;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 12px;color:#111827;font-size:14px;">${escapeHtml(value)}</td>
  </tr>`
}

function buildHtml(i: LeadInput): string {
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <p style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#F5871F;font-weight:700;margin:0 0 6px;">MESA · Sitio web</p>
      <h1 style="color:#111827;font-size:20px;margin:0 0 16px;">${i.plan ? `Solicitud de ${escapeHtml(i.plan)}` : "Nueva solicitud de demo"}</h1>
      <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
        ${row("Local", i.local)}
        ${row("Nombre", i.nombre)}
        ${row("Correo / teléfono", i.contacto)}
        ${row("Teléfono / WhatsApp", i.telefono)}
        ${row("Tipo de negocio", i.negocio)}
        ${row("Ciudad", i.ciudad)}
        ${row("Plan de interés", i.plan)}
        ${row("Mensaje", i.mensaje)}
      </table>
      <p style="color:#9CA3AF;font-size:11px;margin-top:18px;">Enviado desde el formulario público de tumesaqr.com. Responde este correo para contactar al prospecto.</p>
    </div>`
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}
