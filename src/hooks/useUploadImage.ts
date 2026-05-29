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

type SignatureResponse = {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder: string
}

async function fetchSignature(folder: string): Promise<SignatureResponse> {
  const response = await fetch("/api/cloudinary-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder }),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody.error ?? "No se pudo obtener la firma de subida")
  }

  return response.json()
}

export function useUploadImage() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  async function uploadImage(
    file: File,
    folder: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      setUploading(true)
      setError("")

      const finalFile = options.alreadyProcessed
        ? file
        : await processImage(file, { removeBg: options.removeBg })

      // 1. Pedir firma al servidor (verifica sesión + rol admin + rate limit)
      const sig = await fetchSignature(folder)

      // 2. Subir a Cloudinary con la firma
      const formData = new FormData()
      formData.append("file", finalFile)
      formData.append("api_key", sig.apiKey)
      formData.append("timestamp", String(sig.timestamp))
      formData.append("signature", sig.signature)
      formData.append("folder", sig.folder)

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
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