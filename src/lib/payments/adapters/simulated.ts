import type { PaymentGatewayAdapter } from "../adapter"
import type { CreateChargeInput, ChargeResult, StatusResult, WebhookResult } from "../types"

/**
 * Pasarela SIMULADA. NO cobra dinero real: genera un id de pago ficticio y una
 * URL de checkout de prueba, y responde "pagado" al consultar/parsing. Sirve
 * para validar el circuito (cobro → estado → webhook → conciliación) sin
 * credenciales. Al integrar una pasarela real se agrega su adaptador y se
 * selecciona por el proveedor conectado del restaurante.
 */
export class SimulatedPaymentAdapter implements PaymentGatewayAdapter {
  readonly name = "simulated"

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const providerPaymentId = `SIMPAY-${crypto.randomUUID()}`
    return {
      status: "pending",
      providerPaymentId,
      checkoutUrl: `${input.returnUrl ?? ""}?sim_payment=${providerPaymentId}`,
      error: null,
    }
  }

  async getStatus(providerPaymentId: string): Promise<StatusResult> {
    return { status: "paid", providerPaymentId }
  }

  async parseWebhook(
    _headers: Record<string, string>,
    rawBody: string
  ): Promise<WebhookResult> {
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
