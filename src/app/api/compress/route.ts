import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import tinify from "tinify"

tinify.key = process.env.TINYPNG_API_KEY!

const MAX_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const


function detectMimeFromBytes(buffer: Buffer): string | null {
  if (buffer.length < 12) return null

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg"
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 &&
    buffer[2] === 0x4e && buffer[3] === 0x47
  ) {
    return "image/png"
  }
  // WebP: "RIFF....WEBP"
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 &&
    buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 &&
    buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return "image/webp"
  }
  return null
}

// Sanitizar nombre de archivo: solo letras, números, guiones, puntos.
// Evita inyección de headers a través de Content-Disposition.
function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100)
  return base || "image"
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // 2. Leer archivo del FormData
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const file = formData.get("image")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Imagen no provista" }, { status: 400 })
  }

  // 3. Validar tipo declarado
  if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
    return NextResponse.json(
      { error: "Tipo de archivo no permitido" },
      { status: 400 }
    )
  }

  // 4. Validar tamaño
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Imagen demasiado grande (máx 10 MB)" },
      { status: 413 }
    )
  }

  // 5. Leer bytes
  const buffer = Buffer.from(await file.arrayBuffer())

  // 6. Verificar MIME real desde los bytes (no confiar en lo que dijo el cliente)
  const realMime = detectMimeFromBytes(buffer)
  if (!realMime || !ALLOWED_MIME_TYPES.includes(realMime as typeof ALLOWED_MIME_TYPES[number])) {
    return NextResponse.json(
      { error: "El archivo no es una imagen válida" },
      { status: 400 }
    )
  }

  // 7. Comprimir con TinyPNG
  try {
    const compressedUint8 = await tinify.fromBuffer(buffer).toBuffer()
    const compressed = Buffer.from(compressedUint8)

    // 8. Responder con tipo verificado y nombre sanitizado
    const safeName = sanitizeFilename(file.name)

    return new NextResponse(compressed, {
      headers: {
        "Content-Type": realMime,
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "X-Original-Size": buffer.length.toString(),
        "X-Compressed-Size": compressed.length.toString(),
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error comprimiendo imagen"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}