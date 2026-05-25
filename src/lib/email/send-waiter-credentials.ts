import "server-only"
import { Resend } from "resend"
import { logger } from "@/lib/logger"

type SendWaiterCredentialsInput = {
  to: string
  name: string
  email: string
  password: string
  loginUrl: string
}

/**
 * Envía un correo con las credenciales al mesero recién creado. Es best-effort:
 * si Resend no está configurado o falla, loguea warning pero NO rompe la
 * creación del waiter (el admin sigue viendo las credenciales en pantalla y
 * puede pasárselas manualmente).
 */
export async function sendWaiterCredentialsEmail(
  input: SendWaiterCredentialsInput
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"

  if (!apiKey) {
    return { sent: false, reason: "RESEND_API_KEY no configurada" }
  }

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: `MESA <${fromEmail}>`,
      to: input.to,
      subject: "Tu acceso a MESA como mesero",
      html: buildHtml(input),
    })

    if (error) {
      logger.warn("Resend rechazó el envío", { error: String(error) })
      return { sent: false, reason: error.message ?? "Error desconocido" }
    }

    return { sent: true }
  } catch (err) {
    logger.warn("Error enviando email de credenciales", { err: String(err) })
    return { sent: false, reason: String(err) }
  }
}

function buildHtml({ name, email, password, loginUrl }: SendWaiterCredentialsInput): string {
  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #1c1917; font-size: 22px; margin: 0 0 8px;">Hola ${escapeHtml(name)},</h1>
      <p style="color: #57534e; font-size: 14px; line-height: 1.5; margin: 0 0 16px;">
        Te han creado una cuenta de mesero en MESA. Estas son tus credenciales para ingresar:
      </p>
      <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px; color: #57534e; font-size: 12px; font-weight: 600;">Correo:</p>
        <p style="margin: 0 0 12px; font-family: monospace; color: #1c1917; font-size: 14px;">${escapeHtml(email)}</p>
        <p style="margin: 0 0 8px; color: #57534e; font-size: 12px; font-weight: 600;">Contraseña temporal:</p>
        <p style="margin: 0; font-family: monospace; color: #1c1917; font-size: 16px; font-weight: bold; letter-spacing: 2px;">${escapeHtml(password)}</p>
      </div>
      <p style="color: #57534e; font-size: 13px; line-height: 1.5; margin: 16px 0;">
        Al ingresar por primera vez te pediremos cambiar la contraseña por una propia.
      </p>
      <a href="${escapeHtml(loginUrl)}" style="display: inline-block; background: #f97316; color: #ffffff; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 14px;">
        Ingresar a MESA
      </a>
      <p style="color: #a8a29e; font-size: 11px; line-height: 1.5; margin-top: 24px;">
        Si no esperabas este correo, ignóralo. Tu cuenta no podrá usarse sin esta contraseña.
      </p>
    </div>
  `
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
