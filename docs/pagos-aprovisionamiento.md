# Pagos y facturación — Guía de aprovisionamiento

Qué conseguir, y en qué orden, para activar el módulo de pagos y facturación
cuando se cierren tratos con clientes. Mientras no haya credenciales, el sistema
opera normalmente **sin** cobro en línea; nada de esto bloquea la operación.

## Estado actual (ya implementado — Fase 1)

- Modelo de datos completo: `restaurant_tax_profile`, `restaurant_payment_account`,
  `payments`, `tax_documents`, `payment_events`, y `orders.payment_id`.
- Pantalla `/admin/pagos`: el restaurante carga su identidad tributaria (RUT,
  razón social, giro, dirección, régimen) y ve el estado de cobros en línea.
- Arquitectura confirmada (**Opción A**): el dinero va **directo a la cuenta de
  cada restaurante**; MESA orquesta y retiene comisión vía *split*. Cada
  restaurante emite su boleta/factura **con su propio RUT**.

Falta solo enchufar dos proveedores externos. No hay que rehacer nada: el modelo
de datos ya está preparado para recibir pagos y documentos.

---

## 1) Pasarela de pago — Mercado Pago Marketplace (recomendado)

Modelo *marketplace*: cada restaurante conecta SU cuenta de Mercado Pago; el
pago se acredita en su cuenta y MESA cobra una comisión por transacción
(`application_fee`). MESA nunca custodia el dinero.

**Qué crear / conseguir:**
- [ ] Cuenta de **Mercado Pago** para MESA (la plataforma) y alta en Mercado Pago Developers.
- [ ] Una **aplicación** en el panel de desarrolladores con el modelo *Marketplace / OAuth* habilitado.
- [ ] Credenciales de la aplicación (primero **de prueba/sandbox**, luego producción):
  - `Client ID` y `Client Secret` (para el OAuth con el que cada restaurante conecta su cuenta).
  - `Access Token` y `Public Key` de la plataforma.
- [ ] Definir la **comisión de MESA por transacción** (monto fijo o %). → `application_fee`.
- [ ] URL de **notificaciones/webhook** (la define MESA; hay que registrarla en la app).

**Alternativas** si no se usa Mercado Pago: Transbank (por comercio, más
complejo para marketplace), Flow o Khipu/Fintoc (transferencia). El diseño se
adapta, pero cambian las credenciales.

---

## 2) Facturación electrónica — proveedor DTE multi-emisor

La boleta/factura la emite el restaurante con su RUT; MESA la orquesta contra un
proveedor que soporte **varios emisores** (LibreDTE, Bsale, SimpleAPI,
Facturación.cl).

**Qué conseguir (a nivel plataforma):**
- [ ] Cuenta y **API key** del proveedor DTE elegido, con ambiente de
  **certificación** (pruebas) y de **producción**.

**Qué conseguir POR CADA restaurante cliente:**
- [ ] **Certificado digital** vigente (.pfx/.p12) del RUT del restaurante + su clave.
- [ ] **Folios CAF** del SII por tipo de documento: **boleta (39)**, **factura (33)** y **nota de crédito (61)**.
- [ ] Datos del emisor: RUT, razón social, giro, actividad económica, dirección, comuna. *(Estos ya se cargan en `/admin/pagos`.)*
- [ ] Pasar la **certificación del SII** (set de pruebas) del emisor antes de emitir documentos reales.

> El certificado y los folios los custodia el **proveedor DTE**, no MESA.

---

## 3) Variables de entorno (a configurar en Railway cuando haya credenciales)

Nombres tentativos; se ajustan al proveedor final. Van en el servicio `Mesa`.

```
# --- Pasarela (Mercado Pago Marketplace) ---
MP_CLIENT_ID=
MP_CLIENT_SECRET=
MP_ACCESS_TOKEN=
MP_PUBLIC_KEY=
MP_WEBHOOK_SECRET=
MP_APPLICATION_FEE=        # monto o % de comisión de MESA por transacción
MP_ENV=sandbox            # sandbox | production

# --- Proveedor de facturación (DTE) ---
DTE_PROVIDER=             # libredte | bsale | simpleapi | ...
DTE_API_URL=
DTE_API_KEY=
DTE_ENV=certificacion     # certificacion | produccion
```

El sistema detectará estas variables para activar el cobro en línea; sin ellas,
`/admin/pagos` seguirá mostrando "cobros en línea próximamente".

---

## 4) Qué haré yo cuando me entregues lo anterior

1. **Fase 2 (sandbox):** adaptador de la pasarela (OAuth de conexión por
   restaurante + cobro con `application_fee` + verificación de webhook), cableado
   al flujo del comensal (botón "Pagar en línea"). Probado contra el sandbox.
2. **Fase 3–4:** adaptador DTE multi-emisor (boleta, factura a empresas con datos
   de receptor, notas de crédito para reembolsos). Probado contra certificación SII.
3. **Fase 5 (producción):** activación real, tras la certificación SII de cada
   emisor y el visto bueno de tu contador.

---

## 5) Pendientes de definición (tú + contador)

- [ ] Comisión de MESA por transacción (monto/%).
- [ ] ¿Se emite documento tributario también en pagos en **efectivo**? (recomendado).
- [ ] Tratamiento tributario de la **propina** en el DTE (normalmente no afecta a IVA).
- [ ] Esquema legal de recaudación/emisión por terceros (revisión de abogado/contador).
- [ ] Proveedor DTE definitivo.

Con estas definiciones y las credenciales, el módulo se activa sin re-arquitectura.
