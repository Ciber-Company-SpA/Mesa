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