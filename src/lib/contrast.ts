function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "")
  const normalized =
    cleaned.length === 3
      ? cleaned.split("").map((c) => c + c).join("")
      : cleaned
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return [r, g, b]
}

function channelLuminance(value: number): number {
  const v = value / 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  )
}

export type HeaderPalette = {
  primary: string
  secondary: string
  accent: string
  pillBackground: string
  pillText: string
  pillRing: string
  cardBackground: string
  cardRing: string
  isLight: boolean
}

export function paletteForBackground(hex: string): HeaderPalette {
  const isLight = relativeLuminance(hex) > 0.4
  return isLight
    ? {
        primary: "#0c0a09",
        secondary: "rgba(28,25,23,0.7)",
        accent: "#c2410c",
        pillBackground: "rgba(12,10,9,0.08)",
        pillText: "#1c1917",
        pillRing: "rgba(12,10,9,0.12)",
        cardBackground: "rgba(12,10,9,0.06)",
        cardRing: "rgba(12,10,9,0.1)",
        isLight: true,
      }
    : {
        primary: "#ffffff",
        secondary: "rgba(254,215,170,0.8)",
        accent: "#fed7aa",
        pillBackground: "rgba(255,255,255,0.1)",
        pillText: "#e7e5e4",
        pillRing: "rgba(255,255,255,0.1)",
        cardBackground: "rgba(255,255,255,0.1)",
        cardRing: "rgba(255,255,255,0.1)",
        isLight: false,
      }
}
