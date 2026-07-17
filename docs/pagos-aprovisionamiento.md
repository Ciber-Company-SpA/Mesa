# Pagos y facturación — Guía de aprovisionamiento

Qué conseguir, y en qué orden, para activar el módulo de pagos y facturación
cuando se cierren tratos con clientes. Mientras no haya credenciales, el sistema
opera normalmente **sin** cobro en línea; nada de esto bloquea la operación.

## Estado actual (ya implementado)

- Modelo de datos completo: `restaurant_tax_profile`, `restaurant_payment_account`,
  `payments`, `tax_documents`, `payment_events`, y `orders.payment_id`.
- **Capa de abstracción de pasarelas** (`src/lib/payments/`): interfaz
  `PaymentGatewayAdapter` (createCharge / getStatus / parseWebhook) + adaptador
  simulado + fábrica por proveedor. Agregar una pasarela real = 1 archivo + 1 case.
- **Conexión por restaurante en `/admin/pagos`**: cada restaurante elige su
  proveedor (Flow, Mercado Pago, Transbank), pega sus 2 credenciales y quedan
  **cifradas en Supabase Vault** (RPC `payment_connect_account`). El dinero va
  **directo a la cuenta de cada restaurante**; MESA nunca lo custodia. MESA cobra
  sus planes por contrato B2B aparte (no por split).
- Edge function `payment-webhook` (verify_jwt=false): registra el evento crudo
  con idempotencia por `unique(source, external_id)`. Parsea JSON (Mercado Pago)
  y form-urlencoded (Flow), y guarda query + headers de firma para conciliación.
- Capa DTE con adaptador simulado + certificado/CAF cifrados en Vault (ver §2).

---

## 1) Pasarelas de pago — investigación verificada (jul 2026)

Las tres pasarelas calzan con el modelo "cada restaurante = su propia cuenta,
2 credenciales pegadas en MESA". Detalle completo con fuentes en el informe
"Pasarelas de pago Chile — Guía de integración MESA" (artifact).

**Orden recomendado de implementación**: ① Flow → ② Mercado Pago → ③ Transbank.

### Flow (recomendada primero)

- Un solo contrato cubre Webpay + Servipag + MACH + khipu/transferencia.
- Alta gratis; comisión 2,89 % + IVA (abono 3er día hábil) o 3,19 % + IVA (día
  siguiente). Monto mínimo > $350. Exige acreditar inicio de actividades SII
  (Ley 21.713).
- Credenciales: `apiKey` (UUID) + `secretKey` (40 hex) — Integraciones →
  Integración por API. **Sandbox = cuenta separada** en sandbox.flow.cl con
  llaves propias.
- API: `POST {base}/api/payment/create` en **form-urlencoded firmado** (ordenar
  params alfabéticamente, concatenar nombre+valor, HMAC-SHA256 con secretKey →
  parámetro `s`). Requiere `email` del pagador. Respuesta `{url, token,
  flowOrder}` → redirigir a `url?token=…`.
- Confirmación: POST a `urlConfirmation` con **solo `token`, sin firma** → la
  validación oficial es re-consultar `payment/getStatus` (firmado). Responder
  200 en <15 s. `urlReturn` también llega por **POST**. Estados: 1 pendiente,
  2 pagada, 3 rechazada, 4 anulada.
- Sin certificación para pasar a producción. Reembolso $202 + IVA y el pagador
  debe aceptarlo (10 días). Fijar `timeout` siempre (sin él la orden no expira).
- Prueba: tarjeta 4051 8856 0044 6623, CVV 123, RUT 11.111.111-1 clave 123.

### Mercado Pago (Checkout Pro)

- Comisión única todos los medios: 3,19 % + IVA (abono al instante) o 2,89 % +
  IVA (10 días). Mínimo $1.000. Alta gratis (Cédula o RUT empresa).
- Credenciales: **Access Token de producción** (`APP_USR-…`) + **clave secreta
  de webhooks** (Tus integraciones → app → Webhooks → Configurar notificaciones).
  Public Key NO se necesita para checkout por redirección.
- API: `POST https://api.mercadopago.com/checkout/preferences` (Bearer token).
  `unit_price` en CLP **entero**; `external_reference` = id del pago MESA;
  `back_urls` y `notification_url` **HTTPS obligatorio**. Redirigir siempre a
  `init_point` (también en pruebas; `sandbox_init_point` está deprecado).
- Webhook firmado: header `x-signature: ts=…,v1=…` + `x-request-id`. Manifest
  `id:{data.id en minúsculas};request-id:{x-request-id};ts:{ts};` → HMAC-SHA256
  hex con la clave secreta → comparar con v1 en tiempo constante. Responder
  200 en <22 s; reintenta cada 15 min. Confirmar SIEMPRE con
  `GET /v1/payments/{id}`. Fallback de conciliación:
  `GET /v1/payments/search?external_reference=…` (12 meses).
- Reembolsos: `POST /v1/payments/{id}/refunds` con `X-Idempotency-Key` (UUID
  v4), hasta 180 días.
- Pruebas: cuentas de prueba (vendedor+comprador, mismo país) con credenciales
  APP_USR del vendedor de prueba. **Los pagos con credenciales de prueba NO
  disparan webhooks** (usar el simulador del panel). Paso a producción: activar
  credenciales (score de calidad ≥73 es medición, no bloqueo).

### Transbank Webpay Plus REST (v1.2)

- Comisiones más bajas: crédito 2,35 % + IVA, débito/prepago 1,75 % + IVA.
  Abono 24/48 h hábiles. Sin mensualidad. Contratación en
  portaltransbank.cl/incorporacion.
- Credenciales: **código de comercio** (12 dígitos, header `Tbk-Api-Key-Id`) +
  **Api Key Secret** (header `Tbk-Api-Key-Secret`, llega POR CORREO al aprobar
  la validación). Integración: credenciales públicas compartidas precargables
  (comercio 597055555532 + llave publicada en transbankdevelopers.cl).
- Hosts: producción `https://webpay3g.transbank.cl`, integración
  `https://webpay3gint.transbank.cl`. `POST /rswebpaytransaction/api/webpay/v1.2/transactions`
  con `{buy_order ≤26 chars único, session_id, amount entero, return_url}` →
  `{token, url}`; token vale **5 minutos**; redirigir con `token_ws`.
- **SIN webhooks**: la confirmación se hace en el handler del `return_url`
  (acepta GET y POST) con `PUT /transactions/{token}` (commit). Aprobado ⇔
  `response_code === 0 && status === "AUTHORIZED"`. 4 flujos de retorno:
  normal (`token_ws`), abandono (`TBK_TOKEN`), timeout del formulario — 4 min
  en producción — (solo `TBK_ORDEN_COMPRA`), error (`token_ws` + `TBK_TOKEN`).
  Candado anti doble-commit + persistir el resultado (getStatus solo 7 días) +
  job de reconciliación para pagos colgados.
- Reembolsos: `POST /transactions/{token}/refunds`; <3 h reversa total; después
  anulación hasta 90 días (débito/prepago solo total). No validar `vci`; no iframe.
- Paso a producción: validación formal POR COMERCIO (formulario de evidencias +
  logo voucher PNG/GIF 130×59 + compra real de $50). MESA puede industrializar
  las evidencias (la integración es idéntica para todos).
- Prueba: VISA 4051 8856 0044 6623 aprueba, MC 5186 0595 5959 0568 rechaza,
  débito 4051 8842 3993 7763; RUT 11.111.111-1 clave 123.

### Qué falta construir al activar cobros (con credenciales sandbox)

- [ ] Adaptadores reales `adapters/flow.ts`, `adapters/mercadopago.ts`,
  `adapters/transbank.ts` (firma/HMAC según cada uno; REST directo con fetch,
  sin SDKs).
- [ ] **Ruta pública de retorno** (GET+POST) para Flow y Transbank; en Transbank
  ejecuta el commit con las credenciales del restaurante dueño del token.
- [ ] Conciliación en `payment-webhook`: validar firma MP / re-consultar Flow y
  actualizar `payments` vía `payment_update_status`.
- [ ] Job de reconciliación de pagos pendientes (obligatorio Transbank, red de
  seguridad Flow/MP).
- [ ] Botón "Pagar en línea" en el flujo del comensal.
- Regla de oro: nunca confiar en el navegador del comensal; comparar monto y
  orden contra lo persistido antes de marcar `paid`.

---

## 2) Facturación electrónica — proveedor DTE multi-emisor

La boleta/factura la emite el restaurante con su RUT; MESA la orquesta contra un
proveedor multi-emisor. Decisión tomada (jul 2026): **LibreDTE vía API Gateway
(apigateway.cl) recomendado; SimpleAPI como plan B** (ver memoria/informe).

**Qué conseguir (a nivel plataforma):**
- [ ] Cuenta y **API key** del proveedor DTE elegido, con ambiente de
  **certificación** (pruebas) y de **producción**.

**Qué conseguir POR CADA restaurante cliente:**
- [ ] **Certificado digital** vigente (.pfx/.p12) del RUT del restaurante + su
  clave. *(Ya se cargan cifrados en Vault desde `/admin/pagos`.)*
- [ ] **Folios CAF** del SII por tipo: **boleta (39)**, **factura (33)** y
  **nota de crédito (61)**. *(Ídem, ya se cargan.)*
- [ ] Datos del emisor (RUT, razón social, giro, actividad, dirección, comuna).
  *(Ya se cargan en `/admin/pagos`.)*
- [ ] Pasar la **certificación del SII** (set de pruebas) del emisor antes de
  emitir documentos reales.

---

## 3) Checklist operativo por restaurante (pasarela)

**Flow**: crear cuenta en flow.cl (RUT + cuenta bancaria + inicio de actividades)
→ elegir tarifa/día de abono → Integraciones → Integración por API → pegar
`apiKey` + `secretKey` en MESA.

**Mercado Pago**: crear cuenta → crear aplicación (CheckoutPro) → activar
credenciales de producción (pide sitio web + industria) → configurar Webhooks
(evento Pagos, URL de MESA) → pegar `Access Token` + `clave secreta de webhooks`
en MESA → elegir plazo de abono.

**Transbank**: contratar Webpay Plus → recibir código de comercio → validación
de integración (MESA prepara evidencias) + compra real $50 → recibir Api Key
Secret por correo → pegar ambas en MESA. (Sin webhook que configurar.)

URL de webhook de MESA (Flow y MP):
`https://khdrxwufrnpjyzzspviu.supabase.co/functions/v1/payment-webhook?provider=<flow|mercadopago>`
— la pantalla `/admin/pagos` la muestra según el proveedor elegido.

---

## 4) Pendientes de definición (tú + contador)

- [ ] ¿Se emite documento tributario también en pagos en **efectivo**? (recomendado).
- [ ] Tratamiento tributario de la **propina** en el DTE (normalmente no afecta IVA).
- [ ] Con Flow: coordinar el "modelo de emisión" en el SII (el comprobante de
  Flow vale como boleta y Flow informa al RCV — evitar duplicidad con las
  boletas propias).
- [ ] Esquema legal de recaudación/emisión (revisión de abogado/contador).

Con las credenciales sandbox de cualquiera de las tres pasarelas, el adaptador
real se implementa y prueba sin re-arquitectura.
