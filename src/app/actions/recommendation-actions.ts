"use server"

import {
  getTopProductsToday as getTopProductsTodayService,
  type RecommendedProduct,
} from "@/services/recommendation-service"
import type { Result } from "@/services/result"

export async function getTopProductsTodayAction(
  restaurantId: number,
  limit = 3
): Promise<Result<RecommendedProduct[]>> {
  return getTopProductsTodayService(restaurantId, limit)
}
