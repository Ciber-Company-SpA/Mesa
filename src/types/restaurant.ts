export type MenuTemplate = "noche" | "aurora" | "cyber-ruby" | "eclipse" | "forest-moss" | "nordic-minimal"

export type OrderDestination = "waiter" | "kitchen"

export type PublicRestaurant = {
  id: number
  restaurant_name: string
  restaurant_logo: string | null
  menu_template: MenuTemplate
}

export type Restaurant = PublicRestaurant & {
  order_destination: OrderDestination
  printer_enabled: boolean
  printer_bluetooth_name: string | null
}
