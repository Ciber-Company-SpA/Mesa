"use server"

import { revalidateTag } from "next/cache"
import {
  createVariant as createVariantService,
  updateVariant as updateVariantService,
  deleteVariant as deleteVariantService,
  type CreatedVariant,
} from "@/services/variant-service"
import type {
  CreateVariantInput,
  UpdateVariantInput,
  DeleteVariantInput,
} from "@/lib/validation/variant"
import type { Result } from "@/services/result"

export async function createVariantAction(
  input: CreateVariantInput
): Promise<Result<CreatedVariant>> {
  const result = await createVariantService(input)

  if (result.ok) {
    revalidateTag("menu", "default")
  }

  return result
}

export async function updateVariantAction(
  input: UpdateVariantInput
): Promise<Result<{ id: number }>> {
  const result = await updateVariantService(input)

  if (result.ok) {
    revalidateTag("menu", "default")
  }

  return result
}

export async function deleteVariantAction(
  input: DeleteVariantInput
): Promise<Result<{ id: number }>> {
  const result = await deleteVariantService(input)

  if (result.ok) {
    revalidateTag("menu", "default")
  }

  return result
}