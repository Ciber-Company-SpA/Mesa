import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Orígenes permitidos para desarrollo (evita errores de CORS en la red local)
  allowedDevOrigins: [
    "192.168.18.74",  // Laptop de Tomy
    "10.46.41.101",   // Laptop de Benja
  ],
};
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
});

