export type MenuHeaderType = "solid" | "gradient"

export type Restaurant = {
  id: number
  restaurant_name: string
  restaurant_logo: string | null
  menu_header_type: MenuHeaderType
  menu_header_color_1: string
  menu_header_color_2: string | null
}
