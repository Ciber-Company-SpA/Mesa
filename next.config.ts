import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
]

const nextConfig: NextConfig = {
  // Orígenes permitidos para desarrollo (evita errores de CORS en la red local)
  allowedDevOrigins: [
    "192.168.18.74",  // Laptop de Tomy
    "10.142.155.101",   // Laptop de Benja
    "192.168.56.1",   // Laptop de Amaro
  ],
  // Las Server Actions cargan imágenes (importar carta con Gemini, hasta 6 fotos en base64).
  // Default es 1MB, lo subimos para que no rechace silenciosamente.
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: "107-1x",
  project: "mesa",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
})