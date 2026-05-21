import { v2 as cloudinary } from "cloudinary"
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const PUBLIC_ID_REGEX = /^[a-zA-Z0-9_\-/.]+$/

export async function DELETE(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // 2. Leer y validar body
  let body: { publicId?: string; productId?: number; variantId?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const { publicId, productId, variantId } = body

  if (!publicId || typeof publicId !== "string") {
    return NextResponse.json({ error: "publicId requerido" }, { status: 400 })
  }
  if (publicId.length > 200 || !PUBLIC_ID_REGEX.test(publicId)) {
    return NextResponse.json({ error: "publicId inválido" }, { status: 400 })
  }
  if (!productId && !variantId) {
    return NextResponse.json(
      { error: "Se requiere productId o variantId" },
      { status: 400 }
    )
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("restaurant_id")
    .eq("auth_user_id", user.id)
    .single()

  if (profileError || !profile?.restaurant_id) {
    return NextResponse.json({ error: "Sin restaurante" }, { status: 403 })
  }

  let belongsToRestaurant = false

  if (productId) {
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("restaurant_id", profile.restaurant_id)
      .maybeSingle()
    belongsToRestaurant = !!data
  } else if (variantId) {
    const { data } = await supabase
      .from("product_variants")
      .select("id, products!inner(restaurant_id)")
      .eq("id", variantId)
      .eq("products.restaurant_id", profile.restaurant_id)
      .maybeSingle()
    belongsToRestaurant = !!data
  }

  if (!belongsToRestaurant) {
    return NextResponse.json(
      { error: "No tienes permiso sobre este recurso" },
      { status: 403 }
    )
  }


  const result = await cloudinary.uploader.destroy(publicId)
  return NextResponse.json(result)
}