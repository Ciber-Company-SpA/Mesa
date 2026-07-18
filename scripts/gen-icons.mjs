// Genera los íconos de MESA (marca naranja + monograma M) para todas las
// superficies instalables, desde un único SVG vectorial (sin assets binarios
// versionados innecesarios). Requiere sharp (ya es dependencia de Next).
//
//   node scripts/gen-icons.mjs
//
// Salidas:
//   public/icons/icon-192.png            PWA "any"
//   public/icons/icon-512.png            PWA "any"
//   public/icons/icon-maskable-512.png   PWA "maskable" (full-bleed, safe zone)
//   public/apple-touch-icon.png          iOS (Safari redondea)
//   build/icon.png (1024)                Electron (electron-builder)
//   assets/icon-only.png (1024)          Capacitor (@capacitor/assets)
import sharp from "sharp"
import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"

// Monograma "M" (mismo trazo geométrico de la marca MESA), en viewBox 32x32.
const M_PATH = "M16 31V18H20L24 23L28 18H32V31H28V24L24 28.5L20 24V31Z"

function svg(size, { rounded }) {
  const rx = rounded ? Math.round(size * 0.22) : 0
  const s = size / 32 // el path base ocupa ~16u de ancho → M ≈ 50% del canvas
  const tx = -0.25 * size
  const ty = -0.2656 * size
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fb923c"/>
      <stop offset=".55" stop-color="#F97316"/>
      <stop offset="1" stop-color="#ea580c"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#g)"/>
  <g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${s.toFixed(4)})">
    <path d="${M_PATH}" fill="#ffffff"/>
  </g>
</svg>`
}

async function render(size, opts, out) {
  await mkdir(dirname(out), { recursive: true })
  await sharp(Buffer.from(svg(size, opts))).png().toFile(out)
  console.log("✓", out)
}

await render(192, { rounded: true }, "public/icons/icon-192.png")
await render(512, { rounded: true }, "public/icons/icon-512.png")
await render(512, { rounded: false }, "public/icons/icon-maskable-512.png")
await render(180, { rounded: false }, "public/apple-touch-icon.png")
await render(180, { rounded: false }, "public/icons/apple-touch-icon.png")
await render(1024, { rounded: true }, "build/icon.png")
await render(1024, { rounded: false }, "assets/icon-only.png")
await render(1024, { rounded: false }, "assets/logo.png")
console.log("Listo.")
