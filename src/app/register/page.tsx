export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">

        <h1 className="text-3xl font-bold text-white text-center mb-2">
          MESA
        </h1>

        <p className="text-zinc-400 text-center mb-8">
          Crea tu restaurante en minutos
        </p>

        <form className="space-y-5">

          <div>
            <label className="block text-sm text-zinc-300 mb-2">
              Nombre del restaurante
            </label>

            <input
              type="text"
              placeholder="Ej: Pizzería Roma"
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-2">
              Nombre del administrador
            </label>

            <input
              type="text"
              placeholder="Ingresa tu nombre"
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

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
              placeholder="••••••••"
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 transition rounded-xl py-3 font-semibold text-white"
          >
            Crear restaurante
          </button>

          <p className="text-sm text-zinc-500 text-center">
            ¿Ya tienes cuenta?{" "}
            <a
              href="/login"
              className="text-orange-500 hover:text-orange-400"
            >
              Inicia sesión
            </a>
          </p>

        </form>
      </div>
    </main>
  )
}