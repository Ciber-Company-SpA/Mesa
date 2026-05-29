import { NextRequest, NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"
import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"
import { createSupabaseServerClient } from "@/lib/supabase/server"

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Reutilizamos la misma Redis instance del rate limit
const redis = Redis.fromEnv()

// 30 firmas por minuto por usuario. Suficiente para subir un producto con
// varias variantes a la vez, pero corta abuso.
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: true,
  prefix: "ratelimit:cloudinary-sign",
})

const ADMIN_ROLE_ID = 2

// Carpetas permitidas en Cloudinary. El cliente NO puede subir a una
// carpeta arbitraria — solo a las que aquí permitimos.
const ALLOWED_FOLDERS = ["mesa-products", "mesa-tables"] as const
type AllowedFolder = typeof ALLOWED_FOLDERS[number]

function isAllowedFolder(value: unknown): value is AllowedFolder {
  return typeof value === "string" && ALLOWED_FOLDERS.includes(value as AllowedFolder)
}

export async function POST(request: NextRequest) {
  // 1. Sesión
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // 2. Rol admin
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role_id")
    .eq("auth_user_id", user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: "Perfil no encontrado" }, { status: 403 })
  }

  if (profile.role_id !== ADMIN_ROLE_ID) {
    return NextResponse.json({ error: "Acceso restringido" }, { status: 403 })
  }

  // 3. Rate limit
  const { success } = await ratelimit.limit(user.id)
  if (!success) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Intenta en un momento." },
      { status: 429 }
    )
  }

  // 4. Validar carpeta solicitada
  const body = await request.json().catch(() => null)
  const folder = body?.folder

  if (!isAllowedFolder(folder)) {
    return NextResponse.json(
      { error: "Carpeta no permitida" },
      { status: 400 }
    )
  }

  // 5. Generar firma temporal
  const timestamp = Math.round(Date.now() / 1000)

  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder,
    },
    process.env.CLOUDINARY_API_SECRET!
  )

  return NextResponse.json({
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    folder,
  })
}