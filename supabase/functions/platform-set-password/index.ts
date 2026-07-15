// Edge Function: platform-set-password
// Cambia la contraseña de un usuario (auth). Solo un operador de plataforma
// puede invocarla: se valida is_platform_owner sobre su JWT (cliente anon con
// Authorization) y el service_role queda aislado dentro de la función. El
// cambio queda registrado en el log de auditoría de la plataforma.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!url || !anon || !svc) return json({ error: "Configuración del servidor incompleta" }, 500);
  if (!authHeader) return json({ error: "No autorizado" }, 401);

  // 1) Validar que quien invoca es operador de plataforma.
  const asOperator = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: isOwner, error: guardErr } = await asOperator.rpc("is_platform_owner");
  if (guardErr || !isOwner) return json({ error: "No autorizado: se requiere operador de plataforma" }, 403);

  // 2) Entrada
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const authUserId = String(body.authUserId ?? "").trim();
  const password = String(body.password ?? "");
  if (!authUserId) return json({ error: "Falta el identificador del usuario" }, 400);
  if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
  if (new TextEncoder().encode(password).length > 72) {
    return json({ error: "La contraseña es demasiado larga (máx. 72 bytes)" }, 400);
  }

  // 3) Cambiar la contraseña con service_role
  const admin = createClient(url, svc);
  const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(authUserId, { password });
  if (updErr || !updated?.user) {
    return json({ error: updErr?.message ?? "No se pudo actualizar la contraseña" }, 400);
  }

  // 4) Auditoría (no bloquea el resultado si falla)
  try {
    await asOperator.rpc("platform_audit_event", {
      p_action: "reset_password",
      p_entity: "user",
      p_entity_id: authUserId,
      p_meta: { email: updated.user.email ?? null },
    });
  } catch (_e) { /* la auditoría no bloquea el resultado */ }

  return json({ ok: true, email: updated.user.email ?? null });
});
