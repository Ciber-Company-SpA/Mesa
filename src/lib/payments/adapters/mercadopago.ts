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
 * Adaptador Mercado Pago — Checkout Pro (hosted por redirección), verificado
 * contra la doc y el API reference de mercadopago.cl (jul 2026).
 *
 * - Credenciales: Access Token de producción (APP_USR-…) + clave secreta de
 *   webhooks. La Public Key NO se necesita para redirección pura.
 * - "Modo prueba" de Checkout Pro = credenciales APP_USR del VENDEDOR DE
 *   PRUEBA (no hay host sandbox: siempre api.mercadopago.com, y siempre se
 *   redirige a init_point — sandbox_init_point está deprecado).
 * - El pago se confirma por webhook firmado: header x-signature (ts=…,v1=…),
 *   manifest `id:{data.id};request-id:{x-request-id};ts:{ts};` con HMAC-SHA256
 *   de la clave secreta. Tras validar, SIEMPRE se re-consulta
 *   GET /v1/payments/{id} — nunca se confía en el retorno del navegador.
 * - El id de la preferencia NO es el id del pago: el payment id (numérico)
 *   llega por webhook o buscando por external_reference (12 meses).
 */

const MP_API = "https://api.mercadopago.com"
/** Mínimo publicado para tarjetas/dinero en cuenta en Chile. */
const MIN_AMOUNT_CLP = 1000
/** Vida del cobro: 1 h (una cuenta de restaurante no debe quedar pagable después). */
const CHARGE_TTL_MS = 3600_000
const FETCH_TIMEOUT_MS = 15_000

const MP_STATUS: Record<string, PaymentStatus> = {
  approved: "paid",
  pending: "pending",
  in_process: "pending",
  authorized: "pending",
  in_mediation: "pending",
  rejected: "failed",
  cancelled: "cancelled",
  refunded: "refunded",
  charged_back: "refunded",
}

type MpCreds = { accessToken: string; webhookSecret: string }

function readCreds(credentials: GatewayCredentials): MpCreds | null {
  const accessToken = typeof credentials.accessToken === "string" ? credentials.accessToken.trim() : ""
  const webhookSecret = typeof credentials.webhookSecret === "string" ? credentials.webhookSecret.trim() : ""
  if (!accessToken) return null
  return { accessToken, webhookSecret }
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

/** Comparación en tiempo constante (evita timing attacks sobre la firma). */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

type MpJson = Record<string, unknown> | null

async function mpRequest(
  method: "GET" | "POST",
  path: string,
  accessToken: string,
  body?: unknown
): Promise<{ json: MpJson; httpStatus: number }> {
  const res = await fetch(`${MP_API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  const json = (await res.json().catch(() => null)) as MpJson
  return { json, httpStatus: res.status }
}

function mpError(json: MpJson, httpStatus: number): string {
  const message = json && typeof json.message === "string" ? json.message : null
  return message ? `Mercado Pago: ${message}` : `Mercado Pago respondió HTTP ${httpStatus}`
}

function mapMpPayment(json: MpJson): { status: PaymentStatus; id: string | null } | null {
  if (!json || typeof json.status !== "string") return null
  const mapped = MP_STATUS[json.status]
  if (!mapped) return null
  return { status: mapped, id: json.id != null ? String(json.id) : null }
}

export class MercadoPagoAdapter implements PaymentGatewayAdapter {
  readonly name = "mercadopago"

  async createCharge(
    input: CreateChargeInput,
    credentials: GatewayCredentials
  ): Promise<ChargeResult> {
    const creds = readCreds(credentials)
    if (!creds) {
      return { status: "failed", providerPaymentId: null, error: "Falta el Access Token de Mercado Pago" }
    }
    const total = Math.round(input.amount + (input.tip ?? 0))
    if (total < MIN_AMOUNT_CLP) {
      return { status: "failed", providerPaymentId: null, error: `Mercado Pago exige un monto mínimo de $${MIN_AMOUNT_CLP}` }
    }
    if (!input.returnUrl) {
      return { status: "failed", providerPaymentId: null, error: "Falta la URL de retorno del pagador (returnUrl)" }
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      return { status: "failed", providerPaymentId: null, error: "Falta NEXT_PUBLIC_SUPABASE_URL para la URL de notificaciones" }
    }

    // external_reference: máx 64 chars, [A-Za-z0-9-_]. Es la llave de
    // conciliación (getStatus también busca por ella).
    const reference = (input.reference?.trim() || `MESA-${crypto.randomUUID()}`)
      .replace(/[^A-Za-z0-9_-]/g, "-")
      .slice(0, 64)

    const body = {
      items: [
        {
          id: reference,
          title: input.description.trim().slice(0, 120) || "Pago MESA",
          quantity: 1,
          currency_id: input.currency || "CLP",
          unit_price: total, // CLP: entero, sin decimales
        },
      ],
      external_reference: reference,
      back_urls: {
        success: input.returnUrl,
        pending: input.returnUrl,
        failure: input.returnUrl,
      },
      auto_return: "approved",
      notification_url: `${supabaseUrl}/functions/v1/payment-webhook?provider=mercadopago`,
      expires: true,
      expiration_date_to: new Date(Date.now() + CHARGE_TTL_MS).toISOString().replace("Z", "+00:00"),
    }

    try {
      const { json, httpStatus } = await mpRequest("POST", "/checkout/preferences", creds.accessToken, body)
      const initPoint = json && typeof json.init_point === "string" ? json.init_point : null
      const prefId = json && json.id != null ? String(json.id) : null
      if (initPoint && prefId) {
        // OJO: prefId es el id de la PREFERENCIA. El payment id llega por
        // webhook (data.id) y la conciliación lo actualiza en payments.
        return { status: "pending", providerPaymentId: prefId, checkoutUrl: initPoint, error: null }
      }
      return { status: "failed", providerPaymentId: null, error: mpError(json, httpStatus) }
    } catch {
      return { status: "failed", providerPaymentId: null, error: "No se pudo contactar a Mercado Pago (red/timeout)" }
    }
  }

  /**
   * Acepta el payment id numérico de MP o una referencia externa (payments.id
   * de MESA); con referencia usa /v1/payments/search (último pago). Un id de
   * preferencia NO es consultable directamente.
   */
  async getStatus(
    providerPaymentId: string,
    credentials: GatewayCredentials
  ): Promise<StatusResult> {
    const creds = readCreds(credentials)
    if (!creds) {
      return { status: "pending", providerPaymentId, error: "Falta el Access Token de Mercado Pago" }
    }
    try {
      if (/^\d+$/.test(providerPaymentId)) {
        const { json, httpStatus } = await mpRequest("GET", `/v1/payments/${providerPaymentId}`, creds.accessToken)
        const mapped = mapMpPayment(json)
        if (mapped) return { status: mapped.status, providerPaymentId: mapped.id ?? providerPaymentId }
        return { status: "pending", providerPaymentId, error: mpError(json, httpStatus) }
      }
      // Búsqueda por referencia externa (verificada: últimos 12 meses).
      const qs = new URLSearchParams({
        external_reference: providerPaymentId,
        sort: "date_created",
        criteria: "desc",
      })
      const { json, httpStatus } = await mpRequest("GET", `/v1/payments/search?${qs}`, creds.accessToken)
      const results = json && Array.isArray(json.results) ? (json.results as Record<string, unknown>[]) : []
      const mapped = mapMpPayment(results[0] ?? null)
      if (mapped) return { status: mapped.status, providerPaymentId: mapped.id }
      if (results.length === 0 && json) {
        return { status: "pending", providerPaymentId, error: "Aún no hay pagos para esa referencia" }
      }
      return { status: "pending", providerPaymentId, error: mpError(json, httpStatus) }
    } catch {
      return { status: "pending", providerPaymentId, error: "No se pudo contactar a Mercado Pago (red/timeout)" }
    }
  }

  async parseWebhook(
    headers: Record<string, string>,
    rawBody: string,
    credentials: GatewayCredentials,
    query?: Record<string, string>
  ): Promise<WebhookResult> {
    const creds = readCreds(credentials)
    if (!creds) return { valid: false, error: "Falta el Access Token de Mercado Pago" }
    if (!creds.webhookSecret) {
      return { valid: false, error: "Falta la clave secreta de webhooks de Mercado Pago" }
    }

    // Headers case-insensitive.
    const h: Record<string, string> = {}
    for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = v

    const xSignature = h["x-signature"] ?? ""
    const xRequestId = h["x-request-id"] ?? ""
    const parts = Object.fromEntries(
      xSignature
        .split(",")
        .map((p) => p.trim().split("=", 2) as [string, string])
        .filter(([k, v]) => k && v)
    )
    const ts = parts.ts
    const v1 = parts.v1
    if (!ts || !v1) return { valid: false, error: "Notificación sin firma x-signature válida" }

    let body: Record<string, unknown> = {}
    try {
      body = JSON.parse(rawBody || "{}") as Record<string, unknown>
    } catch {
      /* body no-JSON: se sigue con la query */
    }
    const data = body.data as Record<string, unknown> | undefined
    const rawDataId = query?.["data.id"] ?? (data?.id != null ? String(data.id) : "")

    // Manifest oficial: pares ausentes se omiten completos; data.id alfanumérico
    // va en minúsculas.
    const manifest =
      (rawDataId ? `id:${rawDataId.toLowerCase()};` : "") +
      (xRequestId ? `request-id:${xRequestId};` : "") +
      `ts:${ts};`

    const expected = await hmacSha256Hex(creds.webhookSecret, manifest)
    if (!timingSafeEqualHex(expected, v1)) {
      return { valid: false, error: "Firma x-signature inválida" }
    }
    if (!rawDataId) {
      // Firma válida pero sin id de pago (p. ej. otro topic): nada que conciliar.
      return { valid: true, providerPaymentId: null }
    }

    // Autenticidad verificada → estado real desde la fuente de verdad.
    const st = await this.getStatus(rawDataId, credentials)
    if (st.error) return { valid: true, providerPaymentId: rawDataId, error: st.error }
    return { valid: true, providerPaymentId: st.providerPaymentId ?? rawDataId, status: st.status }
  }
}
