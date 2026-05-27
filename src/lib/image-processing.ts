import imageCompression from "browser-image-compression"

const DEFAULT_COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  initialQuality: 0.8,
}

export async function compressInBrowser(file: File): Promise<File> {
  try {
    const compressed = await imageCompression(file, DEFAULT_COMPRESSION_OPTIONS)
    return new File([compressed], file.name, { type: compressed.type || file.type })
  } catch {
    return file
  }
}

export async function removeBackgroundRequest(file: File): Promise<File | null> {
  const formData = new FormData()
  formData.append("image", file)

  const response = await fetch("/api/remove-background", {
    method: "POST",
    body: formData,
  })

  if (!response.ok) return null

  const blob = await response.blob()
  return new File([blob], file.name.replace(/\.[^.]+$/, ".png"), { type: "image/png" })
}

export type ProcessImageOptions = {
  removeBg?: boolean
}

export async function processImage(
  file: File,
  { removeBg = false }: ProcessImageOptions = {}
): Promise<File> {
  let current = file

  if (removeBg) {
    const withoutBg = await removeBackgroundRequest(current)
    if (withoutBg) current = withoutBg
  }

  current = await compressInBrowser(current)
  return current
}
