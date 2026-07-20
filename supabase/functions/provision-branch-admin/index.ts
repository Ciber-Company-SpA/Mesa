// Edge Function: provision-branch-admin
// El DUEÑO de un grupo crea un ADMINISTRADOR DE LOCAL: un usuario role_id=2
// ligado SOLO a una sucursal que le pertenece. Crea el auth user con Admin API
// (SIN restaurant_id en metadata → el trigger NO lo crea como mesero) y luego
// inserta la fila vía link_branch_admin (SECURITY DEFINER, valida que el caller
// sea dueño de la sucursal). Si el link falla, borra el auth user. Devuelve la
// contraseña temporal (must_change_password fuerza el cambio al primer ingreso).
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
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const restaurantId = Number(body.restaurantId);
  if (!email || !email.includes("@")) return json({ error: "Correo inválido" }, 400);
  if (!Number.isFinite(restaurantId)) return json({ error: "Sucursal inválida" }, 400);

  // Crear el auth user (sin restaurant_id en metadata → el trigger no lo toca).
  const admin = createClient(url, svc);
  const password = genPassword();
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { admin_name: name || "Administrador", must_change_password: true },
  });
  if (cErr || !created?.user) {
    const m = (cErr?.message ?? "").toLowerCase();
    if (m.includes("already") || m.includes("registered")) {
      return json({ ok: false, error: "Ya existe un usuario con ese correo" });
    }
    return json({ ok: false, error: "No se pudo crear el administrador" });
  }

  // Ligar la fila con el guard de dueño (as-user). Si falla, revertir el auth user.
  const { error: linkErr } = await asUser.rpc("link_branch_admin", {
    p_auth_user_id: created.user.id,
    p_email: email,
    p_name: name,
    p_restaurant_id: restaurantId,
  });
  if (linkErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    const msg = linkErr.message?.includes("dueño") ? "No sos dueño de esa sucursal" : "No se pudo crear el administrador";
    return json({ ok: false, error: msg }, 403);
  }

  return json({ ok: true, password });
});
