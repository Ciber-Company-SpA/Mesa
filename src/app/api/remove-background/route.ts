import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  // 1. Verificar sesión de Supabase
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // 2. Leer el archivo del FormData
  const formData = await request.formData()
  const file = formData.get("image")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta la imagen" }, { status: 400 })
  }

  // 3. Validaciones
  const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Imagen demasiado grande" }, { status: 400 })
  }
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Tipo de archivo no permitido" }, { status: 400 })
  }

  // 4. Llamar a remove.bg desde el servidor
  const removeBgFormData = new FormData()
  removeBgFormData.append("image_file", file)
  removeBgFormData.append("size", "auto")

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: {
      "X-Api-Key": process.env.REMOVEBG_API_KEY!,
    },
    body: removeBgFormData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Error de remove.bg:", response.status, errorText)
    return NextResponse.json(
      { error: "No se pudo procesar la imagen" },
      { status: 502 }
    )
  }

  const imageBuffer = await response.arrayBuffer()
  return new NextResponse(imageBuffer, {
    headers: {
      "Content-Type": "image/png",
    },
  })
}