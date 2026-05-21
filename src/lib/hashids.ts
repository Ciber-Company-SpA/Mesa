import Hashids from "hashids"

const HASHIDS_SALT = process.env.NEXT_PUBLIC_HASHIDS_SALT ?? "mesa-fallback-salt"

const hashids = new Hashids(HASHIDS_SALT, 8)

export function encodeId(id: number): string {
  return hashids.encode(id)
}

export function decodeId(hash: string): number | null {
  const decoded = hashids.decode(hash)
  return decoded.length > 0 ? Number(decoded[0]) : null
}