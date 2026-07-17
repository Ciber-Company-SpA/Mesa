/**
 * Smoke E2E del adaptador Mercado Pago (Checkout Pro) en modo prueba.
 * No cobra dinero real si se usan credenciales de un VENDEDOR DE PRUEBA.
 *
 * Uso:
 *   MP_ACCESS_TOKEN=APP_USR-... [MP_WEBHOOK_SECRET=...] npx --yes tsx scripts/mp-sandbox-smoke.mts
 *   MP_ACCESS_TOKEN=... MP_PAYMENT_ID=123 npx --yes tsx scripts/mp-sandbox-smoke.mts   (consultar un pago)
 *
 * Credenciales de prueba: Mercado Pago Developers → Tus integraciones → tu
 * aplicación → Cuentas de prueba → entrar con el VENDEDOR de prueba y copiar
 * su Access Token (APP_USR-…) de producción. Se paga con el COMPRADOR de
 * prueba en ventana de incógnito (tarjetas: Visa 4168 8188 4444 7115,
 * CVV 123, 11/30, titular APRO).
 *
 * OJO: los pagos con credenciales de prueba NO disparan webhooks — el webhook
 * se prueba con el simulador del panel apuntando a
 * https://khdrxwufrnpjyzzspviu.supabase.co/functions/v1/payment-webhook?provider=mercadopago
 */
import { MercadoPagoAdapter } from "../src/lib/payments/adapters/mercadopago"

const accessToken = process.env.MP_ACCESS_TOKEN
if (!accessToken) {
  console.error("Falta MP_ACCESS_TOKEN (Access Token del vendedor de prueba).")
  process.exit(1)
}
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://khdrxwufrnpjyzzspviu.supabase.co"

const credentials = {
  accessToken,
  webhookSecret: process.env.MP_WEBHOOK_SECRET ?? "",
  environment: "test",
}
const adapter = new MercadoPagoAdapter()

// Modo 2: consultar un pago o una referencia existente.
const existing = process.env.MP_PAYMENT_ID
if (existing) {
  console.log("getStatus →", await adapter.getStatus(existing, credentials))
  process.exit(0)
}

// Modo 1: crear una preferencia nueva.
const reference = `SMOKE-${Date.now()}`
const charge = await adapter.createCharge(
  {
    amount: 900,
    tip: 100,
    currency: "CLP",
    description: "Smoke test MESA (prueba)",
    reference,
    payerEmail: "test_user@testuser.com",
    returnUrl: "https://tumesaqr.com",
  },
  credentials
)
console.log("createCharge →", charge)
if (!charge.providerPaymentId) process.exit(1)

console.log("\n➡ Abrí la URL de checkout logueado como COMPRADOR de prueba (incógnito).")
console.log(`➡ Después: MP_ACCESS_TOKEN=... MP_PAYMENT_ID=${reference} npx --yes tsx scripts/mp-sandbox-smoke.mts`)
console.log("   (la referencia busca el pago vía /v1/payments/search)\n")

console.log("getStatus por referencia →", await adapter.getStatus(reference, credentials))
