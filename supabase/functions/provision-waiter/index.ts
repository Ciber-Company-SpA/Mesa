// Edge Function: provision-waiter
// Crea la cuenta de un mesero/cocina/caja SIN depender del signup público
// (desactivado). Valida que quien invoca sea ADMIN del restaurante destino
// (guard sobre su JWT) y usa service_role — aislado dentro de la función —
// para crear el usuario con Admin API. El trigger handle_new_user lo inserta
// como mesero PENDIENTE (rama con restaurant_id en user_metadata); luego el
// server action lo liga con assign_waiter. Devuelve la contraseña temporal.
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

function genPassword(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
  const max = Math.floor(256 / abc.length) * abc.length; // 216 (evita sesgo de módulo)
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

  // 1) Resolver al invocador y exigir que sea ADMIN del restaurante destino.
  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: "No autorizado" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const restaurantId = Number(body.restaurantId);
  if (!email || !email.includes("@")) return json({ error: "Correo inválido" }, 400);
  if (!Number.isFinite(restaurantId)) return json({ error: "Restaurante inválido" }, 400);

  // La policy RLS de users deja al admin leer su propia fila (auth.uid()).
  const { data: profile } = await asUser
    .from("users")
    .select("role_id, restaurant_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile || profile.role_id !== 2) return json({ error: "Se requiere administrador" }, 403);
  if (profile.restaurant_id !== restaurantId) {
    return json({ error: "No tenés permiso sobre este restaurante" }, 403);
  }

  // 2) Crear el usuario con service_role. user_metadata.restaurant_id hace que
  //    el trigger lo cree como mesero pendiente (no confía en ese id: lo liga
  //    después assign_waiter, que revalida al admin).
  const admin = createClient(url, svc);
  const password = genPassword();
  const { error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      admin_name: name || "Mesero",
      restaurant_id: restaurantId,
      must_change_password: true,
    },
  });
  if (cErr) {
    if ((cErr.message ?? "").toLowerCase().includes("already") || (cErr.message ?? "").toLowerCase().includes("registered")) {
      return json({ ok: false, error: "Ya existe un usuario con ese correo" });
    }
    return json({ ok: false, error: "No se pudo crear el mesero" });
  }

  return json({ ok: true, password });
});
