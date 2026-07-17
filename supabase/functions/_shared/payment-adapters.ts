// Adaptadores de pasarelas de pago para las EDGE FUNCTIONS (Deno).
// ESPEJO de src/lib/payments/* del app Next (misma lógica, mismos contratos,
// verificados contra las docs oficiales jul 2026) — mantener en sincronía.
// Diferencias con la copia de src: SUPABASE_URL sale de Deno.env y las URLs
// de notificación llevan &ref=<referencia MESA> para que el webhook resuelva
// el pago sin adivinar.

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "cancelled"

export type CreateChargeInput = {
  amount: number
  tip?: number
  currency: string
  description: string
  reference?: string | null
  payerEmail?: string | null
  returnUrl?: string
}

export type ChargeResult = {
  status: PaymentStatus
  providerPaymentId: string | null
  checkoutUrl?: string | null
  error?: string | null
}

export type StatusResult = {
  status: PaymentStatus
  providerPaymentId?: string | null
  error?: string | null
}

export type WebhookResult = {
  valid: boolean
  providerPaymentId?: string | null
  status?: PaymentStatus
  error?: string | null
}

export type GatewayCredentials = Record<string, unknown>

export interface PaymentGatewayAdapter {
  readonly name: string
  createCharge(input: CreateChargeInput, credentials: GatewayCredentials): Promise<ChargeResult>
  getStatus(providerPaymentId: string, credentials: GatewayCredentials): Promise<StatusResult>
  parseWebhook(
    headers: Record<string, string>,
    rawBody: string,
    credentials: GatewayCredentials,
    query?: Record<string, string>
  ): Promise<WebhookResult>
}

const FETCH_TIMEOUT_MS = 15_000

function supabaseUrl(): string {
  return Deno.env.get("SUPABASE_URL") ?? ""
}

function webhookUrl(provider: string, reference: string): string {
  return `${supabaseUrl()}/functions/v1/payment-webhook?provider=${provider}&ref=${encodeURIComponent(reference)}`
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

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ─────────────────────────── SIMULADO ───────────────────────────

export class SimulatedPaymentAdapter implements PaymentGatewayAdapter {
  readonly name = "simulated"

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const providerPaymentId = `SIMPAY-${crypto.randomUUID()}`
    return {
      status: "pending",
      providerPaymentId,
      checkoutUrl: `${input.returnUrl ?? ""}${(input.returnUrl ?? "").includes("?") ? "&" : "?"}sim_payment=${providerPaymentId}`,
      error: null,
    }
  }

  async getStatus(providerPaymentId: string): Promise<StatusResult> {
    return { status: "paid", providerPaymentId }
  }

  async parseWebhook(_h: Record<string, string>, rawBody: string): Promise<WebhookResult> {
    try {
      const body = JSON.parse(rawBody || "{}") as { providerPaymentId?: string; status?: string }
      return {
        valid: true,
        providerPaymentId: body.providerPaymentId ?? null,
        status: body.status === "failed" ? "failed" : "paid",
      }
    } catch {
      return { valid: false, error: "Payload inválido" }
    }
  }
}

// ─────────────────────────── FLOW ───────────────────────────

const FLOW_HOSTS = { production: "https://www.flow.cl/api", test: "https://sandbox.flow.cl/api" } as const
const FLOW_STATUS: Record<number, PaymentStatus> = { 1: "pending", 2: "paid", 3: "failed", 4: "cancelled" }
const FLOW_CHARGE_TIMEOUT_SECONDS = 3600
const FLOW_MIN_AMOUNT_CLP = 350

type FlowCreds = { apiKey: string; secretKey: string; base: string }

function readFlowCreds(credentials: GatewayCredentials): FlowCreds | null {
  const apiKey = typeof credentials.apiKey === "string" ? credentials.apiKey.trim() : ""
  const secretKey = typeof credentials.secretKey === "string" ? credentials.secretKey.trim() : ""
  if (!apiKey || !secretKey) return null
  const base = credentials.environment === "test" ? FLOW_HOSTS.test : FLOW_HOSTS.production
  return { apiKey, secretKey, base }
}

async function flowSign(params: Record<string, string>, secretKey: string): Promise<URLSearchParams> {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => k + params[k])
    .join("")
  const s = await hmacSha256Hex(secretKey, toSign)
  return new URLSearchParams({ ...params, s })
}

type Json = Record<string, unknown> | null

async function flowRequest(method: "GET" | "POST", url: string, body?: URLSearchParams) {
  const res = await fetch(url, {
    method,
    headers: method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : undefined,
    body: body?.toString(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  const json = (await res.json().catch(() => null)) as Json
  return { json, httpStatus: res.status }
}

function flowError(json: Json, httpStatus: number): string {
  const message = json && typeof json.message === "string" ? json.message : null
  return message ? `Flow: ${message}` : `Flow respondió HTTP ${httpStatus}`
}

export class FlowPaymentAdapter implements PaymentGatewayAdapter {
  readonly name = "flow"

  async createCharge(input: CreateChargeInput, credentials: GatewayCredentials): Promise<ChargeResult> {
    const creds = readFlowCreds(credentials)
    if (!creds) return { status: "failed", providerPaymentId: null, error: "Credenciales de Flow incompletas (apiKey y secretKey)" }
    const email = input.payerEmail?.trim()
    if (!email) return { status: "failed", providerPaymentId: null, error: "Flow exige el email del pagador" }
    const total = Math.round(input.amount + (input.tip ?? 0))
    if (!(total > FLOW_MIN_AMOUNT_CLP)) {
      return { status: "failed", providerPaymentId: null, error: `Flow exige un monto mayor a $${FLOW_MIN_AMOUNT_CLP}` }
    }
    if (!input.returnUrl) return { status: "failed", providerPaymentId: null, error: "Falta la URL de retorno del pagador (returnUrl)" }

    const reference = input.reference?.trim() || `MESA-${crypto.randomUUID()}`
    const params: Record<string, string> = {
      apiKey: creds.apiKey,
      amount: String(total),
      commerceOrder: reference,
      currency: input.currency || "CLP",
      email,
      paymentMethod: "9",
      subject: input.description.replace(/[&+"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Pago MESA",
      timeout: String(FLOW_CHARGE_TIMEOUT_SECONDS),
      urlConfirmation: webhookUrl("flow", reference),
      urlReturn: input.returnUrl,
    }

    try {
      const body = await flowSign(params, creds.secretKey)
      const { json, httpStatus } = await flowRequest("POST", `${creds.base}/payment/create`, body)
      const token = json && typeof json.token === "string" ? json.token : null
      const url = json && typeof json.url === "string" ? json.url : null
      if (token && url) {
        return { status: "pending", providerPaymentId: token, checkoutUrl: `${url}?token=${token}`, error: null }
      }
      return { status: "failed", providerPaymentId: null, error: flowError(json, httpStatus) }
    } catch {
      return { status: "failed", providerPaymentId: null, error: "No se pudo contactar a Flow (red/timeout)" }
    }
  }

  async getStatus(providerPaymentId: string, credentials: GatewayCredentials): Promise<StatusResult> {
    const creds = readFlowCreds(credentials)
    if (!creds) return { status: "pending", providerPaymentId, error: "Credenciales de Flow incompletas (apiKey y secretKey)" }
    try {
      const qs = await flowSign({ apiKey: creds.apiKey, token: providerPaymentId }, creds.secretKey)
      const { json, httpStatus } = await flowRequest("GET", `${creds.base}/payment/getStatus?${qs}`)
      const raw = json && typeof json.status === "number" ? json.status : null
      const mapped = raw != null ? FLOW_STATUS[raw] : undefined
      if (mapped) return { status: mapped, providerPaymentId }
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
    const token = new URLSearchParams(rawBody).get("token")?.trim()
    if (!token) return { valid: false, error: "Notificación de Flow sin token" }
    const st = await this.getStatus(token, credentials)
    if (st.error) return { valid: false, providerPaymentId: token, error: st.error }
    return { valid: true, providerPaymentId: token, status: st.status }
  }
}

// ─────────────────────────── MERCADO PAGO ───────────────────────────

const MP_API = "https://api.mercadopago.com"
const MP_MIN_AMOUNT_CLP = 1000
const MP_CHARGE_TTL_MS = 3600_000

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

function readMpCreds(credentials: GatewayCredentials): MpCreds | null {
  const accessToken = typeof credentials.accessToken === "string" ? credentials.accessToken.trim() : ""
  const webhookSecret = typeof credentials.webhookSecret === "string" ? credentials.webhookSecret.trim() : ""
  if (!accessToken) return null
  return { accessToken, webhookSecret }
}

async function mpRequest(method: "GET" | "POST", path: string, accessToken: string, body?: unknown) {
  const res = await fetch(`${MP_API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  const json = (await res.json().catch(() => null)) as Json
  return { json, httpStatus: res.status }
}

function mpError(json: Json, httpStatus: number): string {
  const message = json && typeof json.message === "string" ? json.message : null
  return message ? `Mercado Pago: ${message}` : `Mercado Pago respondió HTTP ${httpStatus}`
}

function mapMpPayment(json: Json): { status: PaymentStatus; id: string | null } | null {
  if (!json || typeof json.status !== "string") return null
  const mapped = MP_STATUS[json.status]
  if (!mapped) return null
  return { status: mapped, id: json.id != null ? String(json.id) : null }
}

export class MercadoPagoAdapter implements PaymentGatewayAdapter {
  readonly name = "mercadopago"

  async createCharge(input: CreateChargeInput, credentials: GatewayCredentials): Promise<ChargeResult> {
    const creds = readMpCreds(credentials)
    if (!creds) return { status: "failed", providerPaymentId: null, error: "Falta el Access Token de Mercado Pago" }
    const total = Math.round(input.amount + (input.tip ?? 0))
    if (total < MP_MIN_AMOUNT_CLP) {
      return { status: "failed", providerPaymentId: null, error: `Mercado Pago exige un monto mínimo de $${MP_MIN_AMOUNT_CLP}` }
    }
    if (!input.returnUrl) return { status: "failed", providerPaymentId: null, error: "Falta la URL de retorno del pagador (returnUrl)" }

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
          unit_price: total,
        },
      ],
      external_reference: reference,
      back_urls: { success: input.returnUrl, pending: input.returnUrl, failure: input.returnUrl },
      auto_return: "approved",
      notification_url: webhookUrl("mercadopago", reference),
      expires: true,
      expiration_date_to: new Date(Date.now() + MP_CHARGE_TTL_MS).toISOString().replace("Z", "+00:00"),
    }

    try {
      const { json, httpStatus } = await mpRequest("POST", "/checkout/preferences", creds.accessToken, body)
      const initPoint = json && typeof json.init_point === "string" ? json.init_point : null
      const prefId = json && json.id != null ? String(json.id) : null
      if (initPoint && prefId) {
        return { status: "pending", providerPaymentId: prefId, checkoutUrl: initPoint, error: null }
      }
      return { status: "failed", providerPaymentId: null, error: mpError(json, httpStatus) }
    } catch {
      return { status: "failed", providerPaymentId: null, error: "No se pudo contactar a Mercado Pago (red/timeout)" }
    }
  }

  async getStatus(providerPaymentId: string, credentials: GatewayCredentials): Promise<StatusResult> {
    const creds = readMpCreds(credentials)
    if (!creds) return { status: "pending", providerPaymentId, error: "Falta el Access Token de Mercado Pago" }
    try {
      if (/^\d+$/.test(providerPaymentId)) {
        const { json, httpStatus } = await mpRequest("GET", `/v1/payments/${providerPaymentId}`, creds.accessToken)
        const mapped = mapMpPayment(json)
        if (mapped) return { status: mapped.status, providerPaymentId: mapped.id ?? providerPaymentId }
        return { status: "pending", providerPaymentId, error: mpError(json, httpStatus) }
      }
      const qs = new URLSearchParams({ external_reference: providerPaymentId, sort: "date_created", criteria: "desc" })
      const { json, httpStatus } = await mpRequest("GET", `/v1/payments/search?${qs}`, creds.accessToken)
      const results = json && Array.isArray(json.results) ? (json.results as Record<string, unknown>[]) : []
      const mapped = mapMpPayment(results[0] ?? null)
      if (mapped) return { status: mapped.status, providerPaymentId: mapped.id }
      if (results.length === 0 && json) return { status: "pending", providerPaymentId, error: "Aún no hay pagos para esa referencia" }
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
    const creds = readMpCreds(credentials)
    if (!creds) return { valid: false, error: "Falta el Access Token de Mercado Pago" }
    if (!creds.webhookSecret) return { valid: false, error: "Falta la clave secreta de webhooks de Mercado Pago" }

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
      /* sin body JSON */
    }
    const data = body.data as Record<string, unknown> | undefined
    const rawDataId = query?.["data.id"] ?? (data?.id != null ? String(data.id) : "")

    const manifest =
      (rawDataId ? `id:${rawDataId.toLowerCase()};` : "") +
      (xRequestId ? `request-id:${xRequestId};` : "") +
      `ts:${ts};`

    const expected = await hmacSha256Hex(creds.webhookSecret, manifest)
    if (!timingSafeEqualHex(expected, v1)) return { valid: false, error: "Firma x-signature inválida" }
    if (!rawDataId) return { valid: true, providerPaymentId: null }

    const st = await this.getStatus(rawDataId, credentials)
    if (st.error) return { valid: true, providerPaymentId: rawDataId, error: st.error }
    return { valid: true, providerPaymentId: st.providerPaymentId ?? rawDataId, status: st.status }
  }
}

// ─────────────────────────── TRANSBANK ───────────────────────────

const TBK_HOSTS = { production: "https://webpay3g.transbank.cl", test: "https://webpay3gint.transbank.cl" } as const
const TBK_PATH = "/rswebpaytransaction/api/webpay/v1.2/transactions"
const TBK_INTEGRATION = {
  commerceCode: "597055555532",
  apiKey: "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C",
}
const TBK_BUY_ORDER_MAX = 26

type TbkCreds = { commerceCode: string; apiKey: string; base: string }

function readTbkCreds(credentials: GatewayCredentials): TbkCreds | null {
  const isTest = credentials.environment === "test"
  let commerceCode = typeof credentials.commerceCode === "string" ? credentials.commerceCode.trim() : ""
  let apiKey = typeof credentials.apiKey === "string" ? credentials.apiKey.trim() : ""
  if (isTest) {
    commerceCode = commerceCode || TBK_INTEGRATION.commerceCode
    apiKey = apiKey || TBK_INTEGRATION.apiKey
  }
  if (!commerceCode || !apiKey) return null
  return { commerceCode, apiKey, base: isTest ? TBK_HOSTS.test : TBK_HOSTS.production }
}

async function tbkRequest(method: "GET" | "POST" | "PUT", creds: TbkCreds, path: string, body?: unknown) {
  const res = await fetch(`${creds.base}${TBK_PATH}${path}`, {
    method,
    headers: {
      "Tbk-Api-Key-Id": creds.commerceCode,
      "Tbk-Api-Key-Secret": creds.apiKey,
      "content-type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  const json = (await res.json().catch(() => null)) as Json
  return { json, httpStatus: res.status }
}

function tbkError(json: Json, httpStatus: number): string {
  const message = json && typeof json.error_message === "string" ? json.error_message : null
  return message ? `Transbank: ${message}` : `Transbank respondió HTTP ${httpStatus}`
}

function mapTbkTransaction(json: Json): PaymentStatus | null {
  if (!json || typeof json.status !== "string") return null
  const code = typeof json.response_code === "number" ? json.response_code : null
  switch (json.status) {
    case "AUTHORIZED":
      return code === 0 ? "paid" : "failed"
    case "CAPTURED":
      return "paid"
    case "INITIALIZED":
      return "pending"
    case "FAILED":
      return "failed"
    case "REVERSED":
    case "NULLIFIED":
    case "PARTIALLY_NULLIFIED":
      return "refunded"
    default:
      return null
  }
}

function makeBuyOrder(reference: string | null | undefined): string {
  const clean = (reference ?? "").trim().replace(/[^0-9A-Za-z|_=&%.,~:/?[+!@()>-]/g, "")
  if (clean.length > 0 && clean.length <= TBK_BUY_ORDER_MAX) return clean
  return `M${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`.slice(0, TBK_BUY_ORDER_MAX)
}

export class TransbankAdapter implements PaymentGatewayAdapter {
  readonly name = "transbank"

  async createCharge(input: CreateChargeInput, credentials: GatewayCredentials): Promise<ChargeResult> {
    const creds = readTbkCreds(credentials)
    if (!creds) {
      return { status: "failed", providerPaymentId: null, error: "Credenciales de Transbank incompletas (código de comercio y Api Key Secret)" }
    }
    const total = Math.round(input.amount + (input.tip ?? 0))
    if (!(total > 0)) return { status: "failed", providerPaymentId: null, error: "El monto debe ser mayor a $0" }
    if (!input.returnUrl) return { status: "failed", providerPaymentId: null, error: "Falta la URL de retorno del pagador (returnUrl)" }

    const buyOrder = makeBuyOrder(input.reference)
    try {
      const { json, httpStatus } = await tbkRequest("POST", creds, "", {
        buy_order: buyOrder,
        session_id: buyOrder,
        amount: total,
        return_url: input.returnUrl,
      })
      const token = json && typeof json.token === "string" ? json.token : null
      const url = json && typeof json.url === "string" ? json.url : null
      if (token && url) {
        return { status: "pending", providerPaymentId: token, checkoutUrl: `${url}?token_ws=${token}`, error: null }
      }
      return { status: "failed", providerPaymentId: null, error: tbkError(json, httpStatus) }
    } catch {
      return { status: "failed", providerPaymentId: null, error: "No se pudo contactar a Transbank (red/timeout)" }
    }
  }

  async getStatus(providerPaymentId: string, credentials: GatewayCredentials): Promise<StatusResult> {
    const creds = readTbkCreds(credentials)
    if (!creds) {
      return { status: "pending", providerPaymentId, error: "Credenciales de Transbank incompletas (código de comercio y Api Key Secret)" }
    }
    try {
      const { json, httpStatus } = await tbkRequest("GET", creds, `/${providerPaymentId}`)
      const mapped = mapTbkTransaction(json)
      if (mapped) return { status: mapped, providerPaymentId }
      return { status: "pending", providerPaymentId, error: tbkError(json, httpStatus) }
    } catch {
      return { status: "pending", providerPaymentId, error: "No se pudo contactar a Transbank (red/timeout)" }
    }
  }

  async parseWebhook(
    _headers: Record<string, string>,
    rawBody: string,
    credentials: GatewayCredentials,
    query?: Record<string, string>
  ): Promise<WebhookResult> {
    const params = new URLSearchParams(rawBody)
    const get = (k: string) => query?.[k] ?? params.get(k) ?? null
    const tokenWs = get("token_ws")
    const tbkToken = get("TBK_TOKEN")
    const tbkOrden = get("TBK_ORDEN_COMPRA")

    if (tokenWs && tbkToken) {
      const st = await this.getStatus(tokenWs, credentials)
      return { valid: true, providerPaymentId: tokenWs, status: st.error ? "failed" : st.status, error: st.error }
    }

    if (tokenWs) {
      const creds = readTbkCreds(credentials)
      if (!creds) return { valid: false, error: "Credenciales de Transbank incompletas" }
      try {
        const { json, httpStatus } = await tbkRequest("PUT", creds, `/${tokenWs}`)
        const mapped = mapTbkTransaction(json)
        if (mapped) return { valid: true, providerPaymentId: tokenWs, status: mapped }
        const st = await this.getStatus(tokenWs, credentials)
        if (!st.error) return { valid: true, providerPaymentId: tokenWs, status: st.status }
        return { valid: true, providerPaymentId: tokenWs, status: "failed", error: tbkError(json, httpStatus) }
      } catch {
        return { valid: true, providerPaymentId: tokenWs, error: "No se pudo confirmar con Transbank (red/timeout); reintentar por getStatus" }
      }
    }

    if (tbkToken) return { valid: true, providerPaymentId: tbkToken, status: "cancelled" }
    if (tbkOrden) return { valid: true, providerPaymentId: null, status: "cancelled" }
    return { valid: false, error: "Retorno de Webpay sin parámetros reconocibles" }
  }
}

// ─────────────────────────── FÁBRICA ───────────────────────────

export function getPaymentAdapter(provider: string | null | undefined): PaymentGatewayAdapter {
  switch (provider) {
    case "flow":
      return new FlowPaymentAdapter()
    case "mercadopago":
      return new MercadoPagoAdapter()
    case "transbank":
      return new TransbankAdapter()
    case "simulated":
    default:
      return new SimulatedPaymentAdapter()
  }
}
