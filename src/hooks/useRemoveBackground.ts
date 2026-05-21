import { useState } from "react"
import { logger } from "@/lib/logger"
import { isNetworkError } from "@/hooks/useOfflineRetry"

export function useRemoveBackground() {
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState("")

  async function removeBackground(file: File): Promise<File | null> {
    try {
      setRemoving(true)
      setError("")

      const formData = new FormData()
      formData.append("image", file)

      const response = await fetch("/api/remove-background", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("Error al quitar fondo")

      const blob = await response.blob()
      return new File([blob], file.name.replace(/\.[^.]+$/, ".png"), { type: "image/png" })
    } catch (err: unknown) {
      if (isNetworkError(err)) throw err
      logger.error("Error quitando fondo", err)
      setError("Error al quitar fondo")
      return null
    } finally {
      setRemoving(false)
    }
  }

  return { removeBackground, removing, error }
}