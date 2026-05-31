import { NextResponse } from "next/server"
import { requireCurrentAdmin } from "@/services/auth-guard"
import { cloudinary } from "@/lib/cloudinary/config"

export async function POST() {
  const guard = await requireCurrentAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: 403 })
  }
  const { restaurantId } = guard.data

  const timestamp = Math.round(Date.now() / 1000)
  const folder = `products/restaurant_${restaurantId}`

  const paramsToSign: Record<string, string | number> = {
    timestamp,
    folder,
  }

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!
  )

  return NextResponse.json({
    signature,
    timestamp,
    folder,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  })
}