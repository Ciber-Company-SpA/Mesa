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
 * Adaptador Transbank Webpay Plus REST v1.2, verificado contra
 * transbankdevelopers.cl (jul 2026).
 *
 * - Credenciales: código de comercio (header Tbk-Api-Key-Id) + Api Key Secret
 *   (header Tbk-Api-Key-Secret). En ambiente de pruebas se usan las
 *   credenciales PÚBLICAS de integración publicadas por Transbank (se
 *   precargan solas si el restaurante no pega nada).
 * - Webpay Plus NO tiene webhooks: la confirmación se hace cuando el pagador
 *   vuelve a return_url. parseWebhook procesa ese RETORNO (token_ws / TBK_*)
 *   y ejecuta el commit (PUT). El caller debe sostener un candado por token
 *   antes de llamar (el pagador puede refrescar la página de retorno); ante
 *   un commit repetido, este adaptador cae a getStatus y resuelve igual.
 * - Aprobado ⇔ response_code === 0 Y status === "AUTHORIZED". No validar vci.
 * - El token de pago vive 5 minutos; getStatus solo responde 7 días.
 */

const TBK_HOSTS = {
  production: "https://webpay3g.transbank.cl",
  test: "https://webpay3gint.transbank.cl",
} as const

const TBK_PATH = "/rswebpaytransaction/api/webpay/v1.2/transactions"

/** Credenciales públicas de integración (documentadas por Transbank). */
const TBK_INTEGRATION = {
  commerceCode: "597055555532",
  apiKey: "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C",
}

const FETCH_TIMEOUT_MS = 15_000
/** buy_order: máximo 26 caracteres, único por transacción. */
const BUY_ORDER_MAX = 26

type TbkCreds = { commerceCode: string; apiKey: string; base: string }

function readCreds(credentials: GatewayCredentials): TbkCreds | null {
  const isTest = credentials.environment === "test"
  let commerceCode = typeof credentials.commerceCode === "string" ? credentials.commerceCode.trim() : ""
  let apiKey = typeof credentials.apiKey === "string" ? credentials.apiKey.trim() : ""
  // En pruebas, Transbank publica credenciales compartidas: precargar.
  if (isTest) {
    commerceCode = commerceCode || TBK_INTEGRATION.commerceCode
    apiKey = apiKey || TBK_INTEGRATION.apiKey
  }
  if (!commerceCode || !apiKey) return null
  return { commerceCode, apiKey, base: isTest ? TBK_HOSTS.test : TBK_HOSTS.production }
}

type TbkJson = Record<string, unknown> | null

async function tbkRequest(
  method: "GET" | "POST" | "PUT",
  creds: TbkCreds,
  path: string,
  body?: unknown
): Promise<{ json: TbkJson; httpStatus: number }> {
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
  const json = (await res.json().catch(() => null)) as TbkJson
  return { json, httpStatus: res.status }
}

function tbkError(json: TbkJson, httpStatus: number): string {
  const message = json && typeof json.error_message === "string" ? json.error_message : null
  return message ? `Transbank: ${message}` : `Transbank respondió HTTP ${httpStatus}`
}

/** Mapea la respuesta de commit/status. Aprobado ⇔ AUTHORIZED + response_code 0. */
function mapTbkTransaction(json: TbkJson): PaymentStatus | null {
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

/** buy_order ≤26 chars, charset restringido; si la referencia no sirve, se genera. */
function makeBuyOrder(reference: string | null | undefined): string {
  const clean = (reference ?? "").trim().replace(/[^0-9A-Za-z|_=&%.,~:/?[+!@()>-]/g, "")
  if (clean.length > 0 && clean.length <= BUY_ORDER_MAX) return clean
  return `M${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`.slice(0, BUY_ORDER_MAX)
}

export class TransbankAdapter implements PaymentGatewayAdapter {
  readonly name = "transbank"

  async createCharge(
    input: CreateChargeInput,
    credentials: GatewayCredentials
  ): Promise<ChargeResult> {
    const creds = readCreds(credentials)
    if (!creds) {
      return { status: "failed", providerPaymentId: null, error: "Credenciales de Transbank incompletas (código de comercio y Api Key Secret)" }
    }
    const total = Math.round(input.amount + (input.tip ?? 0))
    if (!(total > 0)) {
      return { status: "failed", providerPaymentId: null, error: "El monto debe ser mayor a $0" }
    }
    if (!input.returnUrl) {
      return { status: "failed", providerPaymentId: null, error: "Falta la URL de retorno del pagador (returnUrl)" }
    }

    const buyOrder = makeBuyOrder(input.reference)

    try {
      const { json, httpStatus } = await tbkRequest("POST", creds, "", {
        buy_order: buyOrder,
        session_id: buyOrder,
        amount: total, // CLP entero
        return_url: input.returnUrl,
      })
      const token = json && typeof json.token === "string" ? json.token : null
      const url = json && typeof json.url === "string" ? json.url : null
      if (token && url) {
        // El token vive 5 minutos: redirigir de inmediato. La redirección por
        // GET con token_ws está soportada desde API 1.1 (el form POST con
        // token_ws es el ejemplo canónico y también sirve).
        return { status: "pending", providerPaymentId: token, checkoutUrl: `${url}?token_ws=${token}`, error: null }
      }
      return { status: "failed", providerPaymentId: null, error: tbkError(json, httpStatus) }
    } catch {
      return { status: "failed", providerPaymentId: null, error: "No se pudo contactar a Transbank (red/timeout)" }
    }
  }

  /** OJO: Transbank solo responde el estado durante 7 días; persistir el commit. */
  async getStatus(
    providerPaymentId: string,
    credentials: GatewayCredentials
  ): Promise<StatusResult> {
    const creds = readCreds(credentials)
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

  /**
   * Procesa el RETORNO de Webpay (no hay webhooks). rawBody = query string o
   * form body del return_url (acepta los 4 flujos documentados):
   *  1. token_ws                → commit (PUT) y mapear resultado.
   *  2. token_ws + TBK_TOKEN    → error en el formulario: consultar, NO commit.
   *  3. TBK_TOKEN               → pago abortado por el pagador.
   *  4. solo TBK_ORDEN_COMPRA   → timeout del formulario (4 min producción).
   */
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

    // Caso 2: error en el formulario — consultar estado, sin commit.
    if (tokenWs && tbkToken) {
      const st = await this.getStatus(tokenWs, credentials)
      return { valid: true, providerPaymentId: tokenWs, status: st.error ? "failed" : st.status, error: st.error }
    }

    // Caso 1: flujo normal — commit obligatorio.
    if (tokenWs) {
      const creds = readCreds(credentials)
      if (!creds) return { valid: false, error: "Credenciales de Transbank incompletas" }
      try {
        const { json, httpStatus } = await tbkRequest("PUT", creds, `/${tokenWs}`)
        const mapped = mapTbkTransaction(json)
        if (mapped) return { valid: true, providerPaymentId: tokenWs, status: mapped }
        // Commit rechazado (p. ej. ya commiteado por un refresh): resolver por estado.
        const st = await this.getStatus(tokenWs, credentials)
        if (!st.error) return { valid: true, providerPaymentId: tokenWs, status: st.status }
        return { valid: true, providerPaymentId: tokenWs, status: "failed", error: tbkError(json, httpStatus) }
      } catch {
        return { valid: true, providerPaymentId: tokenWs, error: "No se pudo confirmar con Transbank (red/timeout); reintentar por getStatus" }
      }
    }

    // Caso 3: abandono (botón "anular compra").
    if (tbkToken) {
      return { valid: true, providerPaymentId: tbkToken, status: "cancelled" }
    }

    // Caso 4: timeout del formulario — no hay token; identificar por buy_order.
    if (tbkOrden) {
      return { valid: true, providerPaymentId: null, status: "cancelled" }
    }

    return { valid: false, error: "Retorno de Webpay sin parámetros reconocibles" }
  }
}
