// hooks/useUploadImage.ts
import { useState } from "react"
import { logger } from "@/lib/logger"
import { isNetworkError } from "@/hooks/useOfflineRetry"
import { processImage, type ProcessImageOptions } from "@/lib/image-processing"

type UploadResult = {
  secure_url: string
  public_id: string
} | null

type UploadOptions = ProcessImageOptions & {
  alreadyProcessed?: boolean
}

type SignResponse = {
  signature: string
  timestamp: number
  folder: string
  apiKey: string
  cloudName: string
}

export function useUploadImage() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  async function uploadImage(
    file: File,
    _preset: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      setUploading(true)
      setError("")

      const finalFile = options.alreadyProcessed
        ? file
        : await processImage(file, { removeBg: options.removeBg })

      const signRes = await fetch("/api/cloudinary-sign", { method: "POST" })
      if (!signRes.ok) {
        throw new Error("No autorizado para subir imágenes")
      }
      const sign = (await signRes.json()) as SignResponse

      const formData = new FormData()
      formData.append("file", finalFile)
      formData.append("api_key", sign.apiKey)
      formData.append("timestamp", String(sign.timestamp))
      formData.append("signature", sign.signature)
      formData.append("folder", sign.folder)

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`,
        { method: "POST", body: formData }
      )

      if (!response.ok) throw new Error("Error al subir imagen")

      const data = await response.json()

      return {
        secure_url: data.secure_url,
        public_id: data.public_id,
      }
    } catch (err: unknown) {
      if (isNetworkError(err)) throw err
      logger.error("Error subiendo imagen", err)
      setError("Error al subir imagen")
      return null
    } finally {
      setUploading(false)
    }
  }

  return { uploadImage, uploading, error }
}