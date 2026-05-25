"use client"

import Link from "next/link"
import { useResetPassword } from "@/hooks/useResetPassword"

export default function ResetPasswordPage() {
  const {
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    loading,
    error,
    done,
    sessionReady,
    sessionError,
    submitNewPassword,
  } = useResetPassword()

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <h1 className="text-center text-3xl font-bold text-white">MESA</h1>
        <p className="mt-2 text-center text-zinc-400">
          {done ? "Contraseña actualizada" : "Define tu nueva contraseña"}
        </p>

        {sessionReady === null ? (
          <p className="mt-6 text-center text-sm text-zinc-400">Validando link...</p>
        ) : sessionReady === false ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              <p className="font-semibold">Link inválido o expirado</p>
              <p className="mt-2 text-red-200/80">
                {sessionError || "Solicita un nuevo correo de recuperación."}
              </p>
            </div>
            <Link
              href="/forgot-password"
              className="block w-full rounded-xl bg-orange-500 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              Solicitar nuevo link
            </Link>
            <Link
              href="/login"
              className="block w-full rounded-xl border border-zinc-700 px-4 py-3 text-center text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
            >
              Volver al login
            </Link>
          </div>
        ) : done ? (
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            <p className="font-semibold">Contraseña actualizada ✓</p>
            <p className="mt-2 text-emerald-200/80">
              Te estamos llevando al login...
            </p>
          </div>
        ) : (
          <form onSubmit={submitNewPassword} className="mt-6 space-y-5">
            <div>
              <label htmlFor="new-password" className="mb-2 block text-sm text-zinc-300">
                Nueva contraseña
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={6}
                disabled={loading}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none transition focus:border-orange-500 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-zinc-500">Mínimo 6 caracteres.</p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm text-zinc-300">
                Confirmar contraseña
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                disabled={loading}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none transition focus:border-orange-500 disabled:opacity-50"
              />
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
              {loading ? "Guardando..." : "Guardar nueva contraseña"}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
