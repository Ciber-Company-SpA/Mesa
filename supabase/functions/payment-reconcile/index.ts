// Edge Function: payment-reconcile
// Red de seguridad programada (la invoca pg_cron cada 10 min vía pg_net).
// Barre los pagos EN LÍNEA colgados y les pregunta el estado real a la
// pasarela (getStatus firmado del adaptador), asentando vía
// payment_apply_gateway_result:
//  - 'pending' con más de 3 min (el circuito normal ya debió resolverlos):
//    cubre el caso "pagó y cerró el navegador" en Transbank (sin webhook) y
//    webhooks perdidos de Flow/MP.
//  - 'authorized' con más de 10 min: candado huérfano de un retorno caído;
//    aplicar el estado real (aunque sea pending) lo libera.
// Ventana: 7 días (límite del getStatus de Transbank). Máx 25 por corrida.
// Es inofensiva de invocar (solo asienta lo que la pasarela confirma), por
// eso verify_jwt=false sin guard extra.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getPaymentAdapter } from "../_shared/payment-adapters.ts";

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

  const admin = createClient(url, svc);
  const now = Date.now();
  const cutoff7d = new Date(now - 7 * 86_400_000).toISOString();
  const cutPending = new Date(now - 3 * 60_000).toISOString();
  const cutAuthorized = new Date(now - 10 * 60_000).toISOString();

  const { data: stuck, error } = await admin
    .from("payments")
    .select("id, restaurant_id, provider, provider_payment_id, status, created_at")
    .eq("method", "online")
    .in("status", ["pending", "authorized"])
    .gte("created_at", cutoff7d)
    .lte("created_at", cutPending)
    .order("created_at", { ascending: true })
    .limit(25);
  if (error) return new Response(JSON.stringify({ error: "query" }), { status: 500 });

  let checked = 0;
  let updated = 0;
  const ctxCache = new Map<number, Record<string, unknown> | null>();

  for (const pay of stuck ?? []) {
    // Un 'authorized' reciente es un retorno EN CURSO: no interferir.
    if (pay.status === "authorized" && pay.created_at > cutAuthorized) continue;
    checked++;

    let ctx = ctxCache.get(pay.restaurant_id);
    if (ctx === undefined) {
      const { data } = await admin.rpc("payment_gateway_context", {
        p_restaurant_id: pay.restaurant_id,
      });
      ctx = (data as Record<string, unknown> | null) ?? null;
      ctxCache.set(pay.restaurant_id, ctx);
    }
    let credentials: Record<string, unknown> = {};
    if (ctx && typeof ctx.credentials === "string" && ctx.credentials) {
      try {
        credentials = JSON.parse(ctx.credentials);
      } catch {
        credentials = {};
      }
    }

    // MP guarda el id de PREFERENCIA (no consultable): usar la referencia
    // externa MESA-P{id}, que getStatus resuelve vía /v1/payments/search.
    const ppid = typeof pay.provider_payment_id === "string" ? pay.provider_payment_id : "";
    const lookupId =
      pay.provider === "mercadopago" ? (/^\d+$/.test(ppid) ? ppid : `MESA-P${pay.id}`) : ppid;
    if (!lookupId) continue;

    try {
      const adapter = getPaymentAdapter(pay.provider);
      const st = await adapter.getStatus(lookupId, credentials);
      if (st.error) continue; // sin confirmación de la pasarela, no tocar

      await admin.rpc("payment_apply_gateway_result", {
        p_payment_id: pay.id,
        p_status: st.status,
        p_provider_payment_id: st.providerPaymentId ?? null,
      });
      if (st.status !== "pending" || pay.status === "authorized") updated++;
    } catch {
      // pasarela caída para este pago: se reintenta en la próxima corrida
    }
  }

  return new Response(JSON.stringify({ ok: true, checked, updated }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
