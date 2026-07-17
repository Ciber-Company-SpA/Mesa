import type { PaymentGatewayAdapter } from "../adapter"
import type {
  CreateChargeInput,
  ChargeResult,
  StatusResult,
  WebhookResult,
  GatewayCredentials,
  PaymentStatus,
} from "../types"

/**
 * Adaptador Flow (flow.cl), verificado contra la spec oficial apiFlow.yaml y
 * developers.flow.cl (jul 2026).
 *
 * - Autenticación: apiKey + firma de TODOS los parámetros con HMAC-SHA256
 *   (ordenados alfabéticamente, concatenados nombre+valor, secretKey como
 *   llave) enviada como parámetro `s`. Requests van form-urlencoded, NO JSON.
 * - Ambientes con cuentas y llaves SEPARADAS: producción www.flow.cl/api,
 *   pruebas sandbox.flow.cl/api (credentials.environment === "test").
 * - El webhook de Flow trae SOLO un token sin firma: la validación oficial es
 *   re-consultar payment/getStatus (firmado). parseWebhook hace exactamente
 *   eso — nunca confía en el POST entrante.
 * - Estados Flow: 1 pendiente · 2 pagada · 3 rechazada · 4 anulada.
 */

const FLOW_HOSTS = {
  production: "https://www.flow.cl/api",
  test: "https://sandbox.flow.cl/api",
} as const

const FLOW_STATUS: Record<number, PaymentStatus> = {
  1: "pending",
  2: "paid",
  3: "failed",
  4: "cancelled",
}

/** Vida del cobro (seg). Sin timeout, la orden de Flow NUNCA expira. */
const CHARGE_TIMEOUT_SECONDS = 3600
/** Flow exige montos mayores a $350 CLP. */
const MIN_AMOUNT_CLP = 350
const FETCH_TIMEOUT_MS = 15_000

type FlowCreds = { apiKey: string; secretKey: string; base: string }

function readCreds(credentials: GatewayCredentials): FlowCreds | null {
  const apiKey = typeof credentials.apiKey === "string" ? credentials.apiKey.trim() : ""
  const secretKey = typeof credentials.secretKey === "string" ? credentials.secretKey.trim() : ""
  if (!apiKey || !secretKey) return null
  const base = credentials.environment === "test" ? FLOW_HOSTS.test : FLOW_HOSTS.production
  return { apiKey, secretKey, base }
}

async function hmacSha256Hex(secret: string, text: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(text))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** Firma Flow: params sin `s`, orden alfabético, concat nombre+valor, HMAC hex. */
async function signParams(
  params: Record<string, string>,
  secretKey: string
): Promise<URLSearchParams> {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => k + params[k])
    .join("")
  const s = await hmacSha256Hex(secretKey, toSign)
  return new URLSearchParams({ ...params, s })
}

type FlowJson = Record<string, unknown> | null

async function flowRequest(
  method: "GET" | "POST",
  url: string,
  body?: URLSearchParams
): Promise<{ json: FlowJson; httpStatus: number }> {
  const res = await fetch(url, {
    method,
    headers: method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : undefined,
    body: body?.toString(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  const json = (await res.json().catch(() => null)) as FlowJson
  return { json, httpStatus: res.status }
}

function flowError(json: FlowJson, httpStatus: number): string {
  const message = json && typeof json.message === "string" ? json.message : null
  return message ? `Flow: ${message}` : `Flow respondió HTTP ${httpStatus}`
}

/** Los caracteres & + " rompen la firma en integraciones Flow: se sanean. */
function sanitizeSubject(text: string): string {
  return text.replace(/[&+"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)
}

export class FlowPaymentAdapter implements PaymentGatewayAdapter {
  readonly name = "flow"

  async createCharge(
    input: CreateChargeInput,
    credentials: GatewayCredentials
  ): Promise<ChargeResult> {
    const creds = readCreds(credentials)
    if (!creds) {
      return { status: "failed", providerPaymentId: null, error: "Credenciales de Flow incompletas (apiKey y secretKey)" }
    }
    const email = input.payerEmail?.trim()
    if (!email) {
      return { status: "failed", providerPaymentId: null, error: "Flow exige el email del pagador" }
    }
    const total = Math.round(input.amount + (input.tip ?? 0))
    if (!(total > MIN_AMOUNT_CLP)) {
      return { status: "failed", providerPaymentId: null, error: `Flow exige un monto mayor a $${MIN_AMOUNT_CLP}` }
    }
    if (!input.returnUrl) {
      return { status: "failed", providerPaymentId: null, error: "Falta la URL de retorno del pagador (returnUrl)" }
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      return { status: "failed", providerPaymentId: null, error: "Falta NEXT_PUBLIC_SUPABASE_URL para la URL de confirmación" }
    }

    // commerceOrder debe ser único por cuenta Flow: usamos la referencia de
    // MESA (payments.id) o generamos una.
    const commerceOrder = input.reference?.trim() || `MESA-${crypto.randomUUID()}`

    const params: Record<string, string> = {
      apiKey: creds.apiKey,
      amount: String(total),
      commerceOrder,
      currency: input.currency || "CLP",
      email,
      paymentMethod: "9", // todos los medios contratados
      subject: sanitizeSubject(input.description) || "Pago MESA",
      timeout: String(CHARGE_TIMEOUT_SECONDS),
      urlConfirmation: `${supabaseUrl}/functions/v1/payment-webhook?provider=flow&ref=${encodeURIComponent(commerceOrder)}`,
      urlReturn: input.returnUrl,
    }

    try {
      const body = await signParams(params, creds.secretKey)
      const { json, httpStatus } = await flowRequest("POST", `${creds.base}/payment/create`, body)
      const token = json && typeof json.token === "string" ? json.token : null
      const url = json && typeof json.url === "string" ? json.url : null
      if (token && url) {
        return {
          status: "pending",
          providerPaymentId: token,
          checkoutUrl: `${url}?token=${token}`,
          error: null,
        }
      }
      return { status: "failed", providerPaymentId: null, error: flowError(json, httpStatus) }
    } catch {
      return { status: "failed", providerPaymentId: null, error: "No se pudo contactar a Flow (red/timeout)" }
    }
  }

  async getStatus(
    providerPaymentId: string,
    credentials: GatewayCredentials
  ): Promise<StatusResult> {
    const creds = readCreds(credentials)
    if (!creds) {
      return { status: "pending", providerPaymentId, error: "Credenciales de Flow incompletas (apiKey y secretKey)" }
    }
    try {
      const qs = await signParams({ apiKey: creds.apiKey, token: providerPaymentId }, creds.secretKey)
      const { json, httpStatus } = await flowRequest("GET", `${creds.base}/payment/getStatus?${qs}`)
      const raw = json && typeof json.status === "number" ? json.status : null
      const mapped = raw != null ? FLOW_STATUS[raw] : undefined
      if (mapped) return { status: mapped, providerPaymentId }
      // Estado desconocido o error del API: no cambiar el estado local.
      return { status: "pending", providerPaymentId, error: flowError(json, httpStatus) }
    } catch {
      return { status: "pending", providerPaymentId, error: "No se pudo contactar a Flow (red/timeout)" }
    }
  }

  async parseWebhook(
    _headers: Record<string, string>,
    rawBody: string,
    credentials: GatewayCredentials
  ): Promise<WebhookResult> {
    // Flow notifica POST form-urlencoded con SOLO `token`, sin firma. La única
    // fuente de verdad es getStatus firmado: se re-consulta siempre.
    const token = new URLSearchParams(rawBody).get("token")?.trim()
    if (!token) return { valid: false, error: "Notificación de Flow sin token" }

    const st = await this.getStatus(token, credentials)
    if (st.error) return { valid: false, providerPaymentId: token, error: st.error }
    return { valid: true, providerPaymentId: token, status: st.status }
  }
}
