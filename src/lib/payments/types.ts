// Tipos del dominio de cobro, independientes del proveedor. La app habla en
// estos términos; cada adaptador traduce a la API de su pasarela (Flow,
// Mercado Pago, Transbank, …).

export type PaymentProvider = "simulated" | "flow" | "mercadopago" | "transbank"

export const PAYMENT_PROVIDER_LABEL: Record<string, string> = {
  simulated: "Simulado (pruebas)",
  flow: "Flow",
  mercadopago: "Mercado Pago",
  transbank: "Transbank (Webpay)",
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "cancelled"

export type CreateChargeInput = {
  /** Monto de la cuenta SIN propina (CLP entero). El adaptador cobra amount + tip. */
  amount: number
  tip?: number
  currency: string
  description: string
  /**
   * Id único del cobro en MESA (ej. payments.id). Viaja a la pasarela como
   * commerceOrder (Flow) / external_reference (MP) / buy_order (Transbank),
   * para conciliar. Si falta, el adaptador genera uno.
   */
  reference?: string | null
  orderIds?: number[]
  tableId?: number | null
  /** Email del pagador. Flow lo EXIGE; MP lo usa si está. */
  payerEmail?: string | null
  /** URL a la que la pasarela devuelve al pagador tras completar. */
  returnUrl?: string
}

export type ChargeResult = {
  status: PaymentStatus
  providerPaymentId: string | null
  /** URL de checkout a la que se redirige al pagador (si aplica). */
  checkoutUrl?: string | null
  error?: string | null
}

export type StatusResult = {
  status: PaymentStatus
  providerPaymentId?: string | null
  error?: string | null
}

/** Resultado de validar/parsear una notificación (webhook) de la pasarela. */
export type WebhookResult = {
  valid: boolean
  providerPaymentId?: string | null
  status?: PaymentStatus
  error?: string | null
}

/**
 * Credenciales del proveedor (forma libre; cada adaptador sabe qué usar).
 * Convención: `environment: "production" | "test"` decide el host/base URL
 * (Flow usa cuentas y llaves DISTINTAS por ambiente; Transbank cambia de
 * webpay3g a webpay3gint; Mercado Pago usa las credenciales del vendedor de
 * prueba). Si falta, los adaptadores asumen producción.
 */
export type GatewayCredentials = Record<string, unknown>
