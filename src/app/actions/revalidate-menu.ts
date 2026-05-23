"use server"

import { revalidateTag } from "next/cache"

export async function revalidateMenu() {
  revalidateTag("menu", "default")
}