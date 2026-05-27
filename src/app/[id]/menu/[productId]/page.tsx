import { notFound } from "next/navigation"
import { getMenuData } from "@/lib/menu/get-menu-data"
import { ProductDetailClient } from "./ProductDetailClient"

export const revalidate = 300

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string; productId: string }>
}) {
  const { id, productId } = await params

  let menu
  try {
    menu = await getMenuData(id)
  } catch {
    notFound()
  }

  return <ProductDetailClient productId={productId} menu={menu} />
}
