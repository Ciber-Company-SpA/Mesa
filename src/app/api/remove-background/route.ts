import { NextRequest, NextResponse } from "next/server"
import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const ADMIN_ROLE_ID = 2

const redis = Redis.fromEnv()
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(15, "1 m"),
  analytics: true,
  prefix: "ratelimit:removebg",
})

export async function POST(request: NextRequest) {
  // 1. Verificar sesión
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // 2. Verificar rol admin  ← FALTABA
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role_id")
    .eq("auth_user_id", user.id)
    .single()
  if (profileError || !profile || profile.role_id !== ADMIN_ROLE_ID) {
    return NextResponse.json({ error: "Acceso restringido" }, { status: 403 })
  }

  // 3. Rate limit  ← FALTABA
  const { success } = await ratelimit.limit(user.id)
  if (!success) {
    return NextResponse.json({ error: "Demasiadas peticiones." }, { status: 429 })
  }

  // 4. Leer el archivo del FormData
  const formData = await request.formData()
  const file = formData.get("image")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta la imagen" }, { status: 400 })
  }

  // 5. Validaciones de tamaño y tipo
  const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Imagen demasiado grande" }, { status: 400 })
  }
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Tipo de archivo no permitido" }, { status: 400 })
  }

  // 6. Llamar a remove.bg desde el servidor
  const removeBgFormData = new FormData()
  removeBgFormData.append("image_file", file)
  removeBgFormData.append("size", "auto")

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": process.env.REMOVEBG_API_KEY! },
    body: removeBgFormData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Error de remove.bg:", response.status, errorText)
    return NextResponse.json({ error: "No se pudo procesar la imagen" }, { status: 502 })
  }

  const imageBuffer = await response.arrayBuffer()
  return new NextResponse(imageBuffer, {
    headers: { "Content-Type": "image/png" },
  })
}