import type { QRCode } from "@/types/qr-code"


export type Table = {
  id: number
  table_number: number
  restaurant_id: number
  qr_code_id: number
  qr_codes: QRCode
}