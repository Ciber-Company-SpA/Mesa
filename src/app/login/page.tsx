export default function LoginPage() {
  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold text-white text-center mb-2">
          MESA
        </h1>

        <p className="text-zinc-400 text-center mb-8">
          Ingresa al panel de tu restaurante
        </p>

        <form className="space-y-5">
          <div>
            <label className="block text-sm text-zinc-300 mb-2">
              Correo
            </label>

            <input
              type="email"
              placeholder="tucorreo@gmail.com"
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-2">
              Contraseña
            </label>

            <input
              type="password"
              placeholder="********"
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 transition rounded-xl py-3 font-semibold text-white"
          >
            Ingresar
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          ¿No tienes cuenta?{" "}
          <a href="/register" className="text-orange-500 hover:text-orange-400">
            Registra tu restaurante
          </a>
        </p>
      </div>
    </main>
  )
}