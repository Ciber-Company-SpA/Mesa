// Edge Function: payment-webhook
// Endpoint público que reciben las pasarelas de pago para notificar el estado
// de un cobro. verify_jwt=false porque el que llama es la pasarela (no envía
// nuestro JWT); la autenticidad real se valida con la firma del proveedor
// cuando se integre el adaptador real. Por ahora registra el evento crudo
// (trazabilidad/idempotencia) y responde 200 rápido, como esperan las pasarelas.
// El proveedor va en la query (?provider=flow|mercadopago|transbank|simulated).
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

  const provider = new URL(req.url).searchParams.get("provider") ?? "unknown";
  const rawBody = await req.text();

  let payload: unknown = null;
  let externalId: string | null = null;
  try {
    payload = JSON.parse(rawBody || "{}");
    const p = payload as Record<string, unknown>;
    externalId = (p.providerPaymentId ?? p.payment_id ?? p.token ?? p.id ?? null) as string | null;
  } catch {
    payload = { raw: rawBody };
  }

  // Registrar el evento (service_role aislado dentro de la función).
  const admin = createClient(url, svc);
  await admin.rpc("payment_record_event", {
    p_source: provider,
    p_external_id: externalId,
    p_payload: payload,
  });

  // La conciliación del pago (validar firma + actualizar estado) se completa al
  // integrar el adaptador real del proveedor. Respondemos 200 para que la
  // pasarela no reintente.
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
