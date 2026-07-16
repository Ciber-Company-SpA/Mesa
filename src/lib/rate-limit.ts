import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { headers } from "next/headers"

const redis = Redis.fromEnv()


export const publicOrderRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "rl:public-order",
  analytics: true,
})


export const removeBgRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "rl:remove-bg",
  analytics: true,
})


export const apiInventoryRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "60 s"),
  prefix: "rl:api-inventory",
  analytics: true,
})


export const leadRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  prefix: "rl:lead",
  analytics: true,
})

export async function getClientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown"
  }
  return h.get("x-real-ip")?.trim() || "unknown"
}

export async function checkPublicOrderLimit(qrToken: string) {
  const ip = await getClientIp()
  const key = `${ip}:qr:${qrToken}`
  return publicOrderRatelimit.limit(key)
}

export async function checkRemoveBgLimit(userId: string) {
  return removeBgRatelimit.limit(`user:${userId}`)
}

/**
 * Rate limit de la API pública de inventario. Se acota por IP + prefijo de la
 * API key (nunca la key completa, que no debe quedar en Redis), frenando la
 * fuerza bruta de tokens y el abuso sin exponer el secreto.
 */
export async function checkApiInventoryLimit(token: string) {
  const ip = await getClientIp()
  const keyPrefix = token.slice(0, 13)
  return apiInventoryRatelimit.limit(`${ip}:${keyPrefix}`)
}

/** Anti-spam del formulario público de leads: por IP. */
export async function checkLeadLimit() {
  const ip = await getClientIp()
  return leadRatelimit.limit(`ip:${ip}`)
}