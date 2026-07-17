import type {
  CreateChargeInput,
  ChargeResult,
  StatusResult,
  WebhookResult,
  GatewayCredentials,
} from "./types"

/**
 * Contrato que cumple cualquier pasarela de pago. La app solo depende de esta
 * interfaz; agregar Flow / Mercado Pago / Transbank es implementar un adaptador
 * y registrarlo en la fábrica, sin tocar el resto del sistema.
 */
export interface PaymentGatewayAdapter {
  /** Identificador del proveedor. */
  readonly name: string

  /** Crea un cobro. Devuelve el estado inicial + (si aplica) la URL de checkout
   *  y el id del pago en la pasarela para conciliar luego. */
  createCharge(input: CreateChargeInput, credentials: GatewayCredentials): Promise<ChargeResult>

  /** Consulta el estado de un cobro en la pasarela (conciliación / respaldo). */
  getStatus(providerPaymentId: string, credentials: GatewayCredentials): Promise<StatusResult>

  /**
   * Valida y parsea una notificación de la pasarela.
   * - Mercado Pago: webhook firmado (x-signature sobre el query param data.id
   *   → por eso se recibe `query`).
   * - Flow: webhook con token sin firma (se valida re-consultando getStatus).
   * - Transbank: NO tiene webhooks — este método procesa el RETORNO del
   *   pagador (token_ws/TBK_*) y ejecuta el commit.
   */
  parseWebhook(
    headers: Record<string, string>,
    rawBody: string,
    credentials: GatewayCredentials,
    query?: Record<string, string>
  ): Promise<WebhookResult>
}
