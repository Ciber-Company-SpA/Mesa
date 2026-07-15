// Edge Function: change-my-password
// Permite al usuario autenticado fijar una contraseña nueva y, en el mismo
// paso, limpiar el flag must_change_password de public.users. Es el ÚNICO
// camino que limpia el flag: el usuario no puede tocar esa columna (RLS sin
// policy de UPDATE) ni el service_role está expuesto fuera de esta función.
// Así, no se puede saltar el cambio obligatorio (antes bastaba un
// auth.updateUser({data:{must_change_password:false}}) desde el cliente).
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

  // 1) Resolver al usuario autenticado desde su propio JWT.
  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: "No autorizado" }, 401);

  // 2) Entrada + validación.
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const newPassword = String(body.newPassword ?? "");
  if (newPassword.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
  if (new TextEncoder().encode(newPassword).length > 72) {
    return json({ error: "La contraseña es demasiado larga (máx. 72 bytes)" }, 400);
  }

  // 3) Cambiar la contraseña y limpiar el flag, ambos con service_role.
  const admin = createClient(url, svc);
  const { error: updErr } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
  if (updErr) return json({ error: "No se pudo actualizar la contraseña" }, 400);

  const { error: flagErr } = await admin
    .from("users")
    .update({ must_change_password: false })
    .eq("auth_user_id", user.id);
  if (flagErr) return json({ error: "La contraseña se cambió, pero quedó pendiente el flag. Reintentá." }, 500);

  return json({ ok: true });
});
