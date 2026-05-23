import { notFound } from "next/navigation"
import { getMenuData } from "@/lib/menu/get-menu-data"
import { MenuClient } from "./MenuClient"

export const revalidate = 300 

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let menu
  try {
    menu = await getMenuData(id)
  } catch {
    notFound()
  }

  return <MenuClient qrCode={id} menu={menu} />
}