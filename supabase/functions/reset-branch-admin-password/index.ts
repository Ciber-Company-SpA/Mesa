// Edge Function: reset-branch-admin-password
// El DUEÑO resetea la contraseña de un ADMINISTRADOR DE LOCAL de una de sus
// sucursales. Valida con branch_admin_auth_id (SECURITY DEFINER: comprueba que
// el caller sea dueño de la sucursal del admin y devuelve su auth_user_id) y
// luego cambia la clave con Admin API + fuerza must_change_password. Devuelve la
// contraseña temporal nueva.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
}

function genPassword(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
  const max = Math.floor(256 / abc.length) * abc.length;
  let out = "";
  while (out.length < 12) {
    const buf = crypto.getRandomValues(new Uint8Array(16));
    for (const b of buf) {
      if (b < max) {
        out += abc[b % abc.length];
        if (out.length === 12) break;
      }
    }
  }
  return out;
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

  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: "No autorizado" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const userId = Number(body.userId);
  if (!Number.isFinite(userId)) return json({ error: "Usuario inválido" }, 400);

  // Valida dueño y obtiene el auth_user_id del admin de local.
  const { data: authId, error: chkErr } = await asUser.rpc("branch_admin_auth_id", { p_user_id: userId });
  if (chkErr || !authId) return json({ ok: false, error: "No autorizado" }, 403);

  const admin = createClient(url, svc);
  const password = genPassword();
  const { error: updErr } = await admin.auth.admin.updateUserById(authId as string, { password });
  if (updErr) return json({ ok: false, error: "No se pudo cambiar la contraseña" });

  // Forzar cambio en el próximo ingreso (columna tamper-proof en public.users).
  await admin.from("users").update({ must_change_password: true }).eq("id", userId);

  return json({ ok: true, password });
});
