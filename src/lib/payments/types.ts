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
  amount: number
  tip?: number
  currency: string
  description: string
  orderIds?: number[]
  tableId?: number | null
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

/** Credenciales del proveedor (forma libre; cada adaptador sabe qué usar). */
export type GatewayCredentials = Record<string, unknown>
