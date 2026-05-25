"use client"

import Link from "next/link"
import { useForgotPassword } from "@/hooks/useForgotPassword"

export default function ForgotPasswordPage() {
  const { email, setEmail, loading, error, sent, requestReset } = useForgotPassword()

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <h1 className="text-center text-3xl font-bold text-white">MESA</h1>
        <p className="mt-2 text-center text-zinc-400">
          {sent ? "Revisa tu correo" : "Recupera tu contraseña"}
        </p>

        {sent ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
              <p className="font-semibold">Correo enviado ✓</p>
              <p className="mt-2 text-emerald-200/80">
                Si <span className="font-mono">{email}</span> está registrado, recibirás un link
                para restablecer tu contraseña. Revisa también la carpeta de spam.
              </p>
            </div>

            <Link
              href="/login"
              className="block w-full rounded-xl border border-zinc-700 px-4 py-3 text-center text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
            >
              Volver al login
            </Link>
          </div>
        ) : (
          <form onSubmit={requestReset} className="mt-6 space-y-5">
            <div>
              <label htmlFor="forgot-email" className="mb-2 block text-sm text-zinc-300">
                Correo registrado
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@gmail.com"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none transition focus:border-orange-500 disabled:opacity-50"
              />
              <p className="mt-2 text-xs text-zinc-500">
                Te enviaremos un correo con un link para crear una nueva contraseña.
              </p>
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar link de recuperación"}
            </button>

            <p className="text-center text-sm text-zinc-500">
              <Link href="/login" className="text-orange-500 hover:text-orange-400">
                Volver al login
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
