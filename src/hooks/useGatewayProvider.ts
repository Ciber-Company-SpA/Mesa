"use client"

import { useEffect, useState } from "react"
import { getGatewayProvider } from "@/services/charge-service"

/**
 * Proveedor de pasarela conectado del restaurante ("flow" | "mercadopago" |
 * "transbank") o null. Habilita el botón "QR de pago" del ChargeDialog.
 * Fail-closed: ante cualquier error se ofrece solo efectivo/tarjeta.
 */
export function useGatewayProvider() {
  const [provider, setProvider] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getGatewayProvider().then((res) => {
      if (!cancelled && res.ok) setProvider(res.data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return provider
}
