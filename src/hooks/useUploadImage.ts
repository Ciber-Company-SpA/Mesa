// src/hooks/useUploadImage.ts
import { useState } from "react"
import { logger } from "@/lib/logger"

export function useUploadImage() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  async function uploadImage(file: File, preset: string): Promise<string | null> {
    try {
      setUploading(true)
      setError("")

      const formData = new FormData()
      formData.append("file", file)
      formData.append("upload_preset", preset)

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formData
        }
      )

      if (!response.ok) throw new Error("Error al subir imagen")

      const data = await response.json()
      return data.secure_url

    } catch (err) {
      logger.error("Error subiendo imagen", err)
      setError(err instanceof Error ? err.message : "Error desconocido")
      return null
    } finally {
      setUploading(false)
    }
  }

  return { uploadImage, uploading, error }
}