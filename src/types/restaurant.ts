export type MenuTemplate = "noche" | "aurora"

export type Restaurant = {
  id: number
  restaurant_name: string
  restaurant_logo: string | null
  menu_template: MenuTemplate
}
