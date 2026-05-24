import { v2 as cloudinary } from "cloudinary"
import { logger } from "@/lib/logger"

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const PUBLIC_ID_REGEX = /^[a-zA-Z0-9_\-/.]+$/

function isValidPublicId(publicId: string): boolean {
  return publicId.length > 0 && publicId.length <= 200 && PUBLIC_ID_REGEX.test(publicId)
}

export async function deleteImageBestEffort(publicId: string | null | undefined): Promise<void> {
  if (!publicId || !isValidPublicId(publicId)) return

  try {
    await cloudinary.uploader.destroy(publicId)
  } catch (err) {
    logger.warn("No se pudo borrar imagen de Cloudinary", { publicId, err: String(err) })
  }
}

export async function deleteImagesBestEffort(publicIds: Array<string | null | undefined>): Promise<void> {
  const validIds = publicIds.filter((id): id is string => Boolean(id) && isValidPublicId(id as string))
  if (validIds.length === 0) return

  await Promise.allSettled(validIds.map((publicId) => cloudinary.uploader.destroy(publicId)))
}
