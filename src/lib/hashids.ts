import Hashids from "hashids"

// OJO: Hashids es OFUSCACIÓN reversible, no cifrado. Solo se usa para no exponer
// IDs numéricos de producto (catálogo público) en las URLs; no protege datos
// sensibles. La sal va con prefijo NEXT_PUBLIC_ porque el decode corre en el
// navegador, así que NO es un secreto: su único fin es que los IDs no sean
// triviales de enumerar a mano.
//
// PENDIENTE DE CONFIG: definí NEXT_PUBLIC_HASHIDS_SALT en el entorno de
// producción (Railway) con un valor propio y aleatorio. Mientras no exista, se
// cae a una sal fija conocida (solo ofuscación mínima). No se lanza excepción
// para no arriesgar el arranque de la app; el aviso queda en consola.
const envSalt = process.env.NEXT_PUBLIC_HASHIDS_SALT

if (!envSalt && process.env.NODE_ENV === "production" && typeof window === "undefined") {
  console.warn(
    "[seguridad] NEXT_PUBLIC_HASHIDS_SALT no está configurada: usando sal por defecto. Definila en Railway."
  )
}

const HASHIDS_SALT = envSalt ?? "mesa-default-salt"

const hashids = new Hashids(HASHIDS_SALT, 8)

export function encodeId(id: number): string {
  return hashids.encode(id)
}

export function decodeId(hash: string): number | null {
  const decoded = hashids.decode(hash)
  return decoded.length > 0 ? Number(decoded[0]) : null
}
