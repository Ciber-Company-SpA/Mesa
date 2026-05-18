import { useState } from "react"
import { useRemoveBackground } from "@/hooks/useRemoveBackground"

async function compressImage(file: File): Promise<File> {
  try {
    const formData = new FormData()
    formData.append("image", file)

    const res = await fetch("/api/compress", {
      method: "POST",
      body: formData,
    })

    if (!res.ok) return file

    const blob = await res.blob()
    return new File([blob], file.name, { type: file.type })
  } catch {
    return file
  }
}

export function useProcessImage() {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const { removeBackground } = useRemoveBackground()

  async function processImage(file: File): Promise<File | null> {
    try {
      setProcessing(true)
      setError("")

      const withoutBackground = await removeBackground(file)
      if (!withoutBackground) throw new Error("Error al procesar imagen")

      const compressed = await compressImage(withoutBackground)

      return compressed
    } catch (err) {
      setError("Error al procesar imagen")
      return null
    } finally {
      setProcessing(false)
    }
  }

  return { processImage, processing, error }
}