// Edge Function: provision-restaurant
// Aprovisiona un cliente completo desde el portal de administración:
// crea el usuario admin (Admin API con service_role) -> el trigger
// handle_new_user crea el restaurante + admin + dueño -> genera N mesas con QR
// -> asigna plan/estado/organización. El service_role SOLO se usa para crear
// el usuario; las mesas y datos comerciales van por RPC con el contexto del
// operador (guard is_platform_owner). Solo un operador de plataforma puede
// invocarla (se valida con is_platform_owner sobre su JWT).
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
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let out = "";
  for (const b of bytes) out += abc[b % abc.length];
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

  // 1) Validar que quien invoca es operador de plataforma (guard sobre su JWT)
  const asOperator = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: isOwner, error: guardErr } = await asOperator.rpc("is_platform_owner");
  if (guardErr || !isOwner) return json({ error: "No autorizado: se requiere operador de plataforma" }, 403);

  // 2) Entrada
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const restaurantName = String(body.restaurantName ?? "").trim();
  const adminName = String(body.adminName ?? "").trim();
  const adminEmail = String(body.adminEmail ?? "").trim().toLowerCase();
  const tables = Math.max(0, Math.min(200, parseInt(String(body.tables ?? "0"), 10) || 0));
  const planId = body.planId ? String(body.planId) : null;
  const organizationId = body.organizationId ? Number(body.organizationId) : null;
  const status = ["trial", "active"].includes(String(body.status)) ? String(body.status) : "active";
  if (!restaurantName) return json({ error: "Falta el nombre del restaurante" }, 400);
  if (!adminEmail || !adminEmail.includes("@")) return json({ error: "Correo del administrador inválido" }, 400);

  const admin = createClient(url, svc);

  // 3) Crear el usuario admin -> el trigger handle_new_user crea restaurante + admin + dueño
  const password = genPassword();
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
    user_metadata: {
      admin_name: adminName || "Administrador",
      restaurant_name: restaurantName,
      must_change_password: true,
    },
  });
  if (cErr || !created?.user) {
    const msg = (cErr?.message ?? "").toLowerCase().includes("already")
      ? "Ya existe un usuario con ese correo"
      : (cErr?.message ?? "No se pudo crear el usuario administrador");
    return json({ error: msg }, 400);
  }
  const authUserId = created.user.id;

  // 4) Resolver el restaurante creado por el trigger (con reintentos por la carrera del trigger)
  let restaurantId: number | null = null;
  for (let i = 0; i < 6; i++) {
    const { data: row } = await admin.from("users").select("restaurant_id").eq("auth_user_id", authUserId).maybeSingle();
    if (row?.restaurant_id) { restaurantId = row.restaurant_id as number; break; }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!restaurantId) return json({ error: "El usuario se creó, pero no se pudo resolver el restaurante." }, 500);

  const warnings: string[] = [];

  // 5) Mesas + QR (RPC con el contexto del operador -> pasa el guard is_platform_owner)
  if (tables > 0) {
    const { error: tErr } = await asOperator.rpc("platform_provision_tables", {
      p_restaurant_id: restaurantId,
      p_count: tables,
    });
    if (tErr) warnings.push("No se pudieron crear las mesas: " + tErr.message);
  }

  // 6) Plan / estado / organización (RPC comercial existente)
  const { error: aErr } = await asOperator.rpc("platform_update_account", {
    p_restaurant_id: restaurantId,
    p_plan_id: planId,
    p_status: status,
    p_trial_ends_at: null,
    p_account_manager: null,
    p_organization_id: organizationId,
    p_notes: null,
  });
  if (aErr) warnings.push("No se pudo asignar plan/organización: " + aErr.message);

  return json({
    ok: true,
    restaurantId,
    restaurantName,
    adminEmail,
    password,
    tablesCreated: warnings.length && tables > 0 ? 0 : tables,
    warnings,
  });
});
