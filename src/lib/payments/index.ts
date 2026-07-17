import type { PaymentGatewayAdapter } from "./adapter"
import { SimulatedPaymentAdapter } from "./adapters/simulated"
import { FlowPaymentAdapter } from "./adapters/flow"
import { MercadoPagoAdapter } from "./adapters/mercadopago"
import { TransbankAdapter } from "./adapters/transbank"

/**
 * Devuelve el adaptador de la pasarela por su nombre (el proveedor conectado
 * del restaurante). Al integrar una pasarela nueva se agrega su adaptador y
 * su case aquí, sin tocar el servicio ni la UI.
 */
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

export * from "./types"
export type { PaymentGatewayAdapter } from "./adapter"
