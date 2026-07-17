/**
 * Smoke E2E del adaptador Flow contra el SANDBOX (sandbox.flow.cl).
 * No toca producción ni cobra dinero real.
 *
 * Uso:
 *   FLOW_API_KEY=xxx FLOW_SECRET_KEY=yyy npx --yes tsx scripts/flow-sandbox-smoke.mts
 *
 * Requiere una cuenta sandbox (registro con datos ficticios en
 * https://sandbox.flow.cl → Integraciones → Integración por API).
 *
 * Qué hace:
 *   1. createCharge de $990 → imprime la URL de checkout. Se puede abrir y
 *      pagar con la tarjeta de prueba 4051 8856 0044 6623 / CVV 123 /
 *      cualquier fecha, RUT 11.111.111-1, clave 123.
 *   2. getStatus del cobro (recién creado debe ser "pending" = estado Flow 1;
 *      tras pagar en el navegador, re-ejecutar con FLOW_TOKEN=... da "paid").
 *   3. parseWebhook simulando la notificación de Flow (token → re-consulta
 *      firmada, igual que hará la conciliación real).
 */
import { FlowPaymentAdapter } from "../src/lib/payments/adapters/flow"

const apiKey = process.env.FLOW_API_KEY
const secretKey = process.env.FLOW_SECRET_KEY
if (!apiKey || !secretKey) {
  console.error("Faltan FLOW_API_KEY y/o FLOW_SECRET_KEY (cuenta sandbox de Flow).")
  process.exit(1)
}
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://khdrxwufrnpjyzzspviu.supabase.co"

const credentials = { apiKey, secretKey, environment: "test" }
const adapter = new FlowPaymentAdapter()

// Modo 2: consultar un token existente (tras pagar en el navegador).
const existingToken = process.env.FLOW_TOKEN
if (existingToken) {
  console.log("getStatus →", await adapter.getStatus(existingToken, credentials))
  console.log("parseWebhook →", await adapter.parseWebhook({}, `token=${existingToken}`, credentials))
  process.exit(0)
}

// Modo 1: crear un cobro nuevo.
const reference = `SMOKE-${Date.now()}`
const charge = await adapter.createCharge(
  {
    amount: 890,
    tip: 100,
    currency: "CLP",
    description: "Smoke test MESA (sandbox)",
    reference,
    payerEmail: "comprador@sandbox.test",
    returnUrl: "https://tumesaqr.com",
  },
  credentials
)
console.log("createCharge →", charge)
if (!charge.providerPaymentId) process.exit(1)

console.log("\n➡ Abrí la URL de checkout de arriba para pagar con la tarjeta de prueba.")
console.log(`➡ Después: FLOW_TOKEN=${charge.providerPaymentId} npx --yes tsx scripts/flow-sandbox-smoke.mts\n`)

console.log("getStatus →", await adapter.getStatus(charge.providerPaymentId, credentials))
console.log("parseWebhook →", await adapter.parseWebhook({}, `token=${charge.providerPaymentId}`, credentials))
