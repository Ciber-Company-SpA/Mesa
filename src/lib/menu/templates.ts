import type { MenuTemplate } from "@/types/restaurant"

export type TemplateMeta = {
  id: MenuTemplate
  label: string
  description: string
  swatch: string
}

export const MENU_TEMPLATES: TemplateMeta[] = [
  {
    id: "noche",
    label: "Noche",
    description: "Fondo oscuro con detalles naranjas. Buen contraste y vista clásica.",
    swatch: "linear-gradient(180deg, #1c1917 0%, #0c0a09 58%, #020617 100%)",
  },
]

export const TEMPLATE_IDS = MENU_TEMPLATES.map((t) => t.id) as [MenuTemplate, ...MenuTemplate[]]
