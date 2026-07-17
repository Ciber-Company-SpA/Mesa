import type { PaymentGatewayAdapter } from "./adapter"
import { SimulatedPaymentAdapter } from "./adapters/simulated"

/**
 * Devuelve el adaptador de la pasarela por su nombre (el proveedor conectado
 * del restaurante). Hoy solo el simulado; al integrar una pasarela real se
 * agrega su adaptador y su case aquí, sin tocar el servicio ni la UI.
 */
export function getPaymentAdapter(provider: string | null | undefined): PaymentGatewayAdapter {
  switch (provider) {
    // case "flow":        return new FlowAdapter()
    // case "mercadopago": return new MercadoPagoAdapter()
    // case "transbank":   return new TransbankAdapter()
    case "simulated":
    default:
      return new SimulatedPaymentAdapter()
  }
}

export * from "./types"
export type { PaymentGatewayAdapter } from "./adapter"
