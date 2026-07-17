// Edge Function: payment-webhook
// Endpoint público que reciben las pasarelas de pago para notificar el estado
// de un cobro. verify_jwt=false porque el que llama es la pasarela (no envía
// nuestro JWT); la autenticidad real se valida al integrar cada adaptador
// (Mercado Pago: firma HMAC x-signature; Flow: re-consulta getStatus firmada).
// Transbank Webpay Plus NO usa webhooks (confirma por retorno + commit).
// Por ahora registra el evento crudo (trazabilidad/idempotencia) y responde
// 200 rápido, como esperan las pasarelas (MP: <22 s; Flow: <15 s).
//
// Formatos verificados (jul 2026):
//  - Mercado Pago: POST ?provider=mercadopago&data.id=123&type=payment con
//    body JSON {action, type, data:{id}} y headers x-signature / x-request-id.
//  - Flow: POST ?provider=flow con body application/x-www-form-urlencoded y
//    un único parámetro `token`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !svc) return new Response("config", { status: 500 });

  const reqUrl = new URL(req.url);
  const provider = reqUrl.searchParams.get("provider") ?? "unknown";
  const rawBody = await req.text();
  const contentType = req.headers.get("content-type") ?? "";

  let payload: Record<string, unknown>;
  let externalId: string | null = null;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    // Flow: form-urlencoded con `token`.
    const form = new URLSearchParams(rawBody);
    payload = Object.fromEntries(form.entries());
    externalId = form.get("token");
  } else {
    try {
      payload = JSON.parse(rawBody || "{}") as Record<string, unknown>;
    } catch {
      payload = { raw: rawBody };
    }
    // Mercado Pago manda el id del pago en query (?data.id=) y en data.id.
    const data = payload.data as Record<string, unknown> | undefined;
    externalId =
      reqUrl.searchParams.get("data.id") ??
      ((data?.id ?? payload.providerPaymentId ?? payload.payment_id ?? payload.token ?? payload.id ?? null) as
        | string
        | null);
    if (externalId != null) externalId = String(externalId);
  }

  // Guardar también la query y los headers de firma para poder validar la
  // autenticidad en la conciliación (MP firma sobre data.id + x-request-id + ts).
  const envelope = {
    query: Object.fromEntries(reqUrl.searchParams.entries()),
    headers: {
      "x-signature": req.headers.get("x-signature"),
      "x-request-id": req.headers.get("x-request-id"),
      "content-type": contentType,
    },
    body: payload,
  };

  // Registrar el evento (service_role aislado dentro de la función; idempotente
  // por unique(source, external_id) cuando el proveedor manda id externo).
  const admin = createClient(url, svc);
  await admin.rpc("payment_record_event", {
    p_source: provider,
    p_external_id: externalId,
    p_payload: envelope,
  });

  // La conciliación del pago (validar firma / re-consultar estado + actualizar
  // payments) se completa al integrar el adaptador real del proveedor.
  // Respondemos 200 para que la pasarela no reintente.
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
