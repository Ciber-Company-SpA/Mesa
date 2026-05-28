import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function proxy(req: NextRequest) {
  // Respuesta inicial mutable: si Supabase rota el JWT durante getUser(),
  // los cookies actualizados se setean acá vía setAll y propagan al navegador.
  let response = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          )
          response = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Solo validamos auth en el middleware. El check de rol/restaurante vive en
  // AdminGuard (cliente) y en cada Server Action que llama el panel. Hacerlo
  // acá agregaba una query a `users` extra por navegación que es propensa a
  // race conditions con el refresh del JWT y patea al usuario a /login sin
  // motivo. Si auth.getUser() acepta el JWT, confiamos.
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL("/login", req.url)
    return NextResponse.redirect(loginUrl)
  }

  return response
}


export const config = {
  matcher: ["/admin/:path*"],
}
