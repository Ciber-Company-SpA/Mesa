/**
 * Smoke E2E del adaptador Transbank contra el ambiente de INTEGRACIÓN
 * (webpay3gint.transbank.cl). Usa las credenciales PÚBLICAS de integración
 * publicadas por Transbank — no requiere cuenta ni cobra dinero real.
 *
 * Uso:
 *   npx --yes tsx scripts/tbk-integration-smoke.mts
 *   TBK_TOKEN=xxx npx --yes tsx scripts/tbk-integration-smoke.mts   (tras pagar)
 *
 * Qué hace:
 *   1. createCharge de $990 → imprime la URL de pago. Se puede abrir y pagar
 *      con la tarjeta de prueba VISA 4051 8856 0044 6623 / CVV 123 /
 *      cualquier fecha; RUT 11.111.111-1, clave 123.
 *   2. getStatus (recién creada = INITIALIZED → "pending").
 *   3. Con TBK_TOKEN: simula el retorno normal (token_ws) → commit → "paid".
 */
import { TransbankAdapter } from "../src/lib/payments/adapters/transbank"

const credentials = {
  environment: "test", // integración: si no hay credenciales, el adaptador precarga las públicas
  ...(process.env.TBK_COMMERCE_CODE ? { commerceCode: process.env.TBK_COMMERCE_CODE } : {}),
  ...(process.env.TBK_API_KEY ? { apiKey: process.env.TBK_API_KEY } : {}),
}
const adapter = new TransbankAdapter()

// Modo 2: tras pagar en el navegador, procesar el "retorno" (commit).
const existingToken = process.env.TBK_TOKEN
if (existingToken) {
  console.log("parseWebhook(retorno token_ws) →", await adapter.parseWebhook({}, `token_ws=${existingToken}`, credentials))
  console.log("getStatus →", await adapter.getStatus(existingToken, credentials))
  process.exit(0)
}

// Modo 1: crear una transacción nueva.
const charge = await adapter.createCharge(
  {
    amount: 890,
    tip: 100,
    currency: "CLP",
    description: "Smoke test MESA (integración)",
    reference: `SMOKE-${Date.now()}`,
    returnUrl: "https://tumesaqr.com",
  },
  credentials
)
console.log("createCharge →", charge)
if (!charge.providerPaymentId) process.exit(1)

console.log("\n➡ Abrí la URL para pagar con la tarjeta de prueba (VISA 4051 8856 0044 6623).")
console.log(`➡ Después: TBK_TOKEN=${charge.providerPaymentId} npx --yes tsx scripts/tbk-integration-smoke.mts\n`)

console.log("getStatus →", await adapter.getStatus(charge.providerPaymentId, credentials))
