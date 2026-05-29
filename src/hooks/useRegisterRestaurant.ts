import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"

export function useRegisterRestaurant() {
  const router = useRouter()

  const [restaurantName, setRestaurantName] = useState("")
  const [adminName, setAdminName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function registerRestaurant(e: React.FormEvent) {
    e.preventDefault()

    try {
      setLoading(true)
      setError("")

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            admin_name: adminName,
            restaurant_name: restaurantName,
            role_id: 2,
          }
        }
      })

      if (authError) throw authError

      router.replace("/login")
    } catch (err: unknown) {
      logger.error("Error registrando restaurante", err)
      setError("Error al registrar restaurante")
    } finally {
      setLoading(false)
    }
  }

  return {
    restaurantName,
    setRestaurantName,
    adminName,
    setAdminName,
    email,
    setEmail,
    password,
    setPassword,
    loading,
    error,
    registerRestaurant
  }
}
