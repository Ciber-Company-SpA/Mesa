export type ReservationStatus = "active" | "cancelled" | "completed"

export type ReservationSource = "manual" | "whatsapp"

export type Reservation = {
  id: number
  table_id: number
  restaurant_id: number
  customer_name: string
  customer_phone: string | null
  party_size: number | null
  starts_at: string
  ends_at: string
  status: ReservationStatus
  source: ReservationSource
  notes: string | null
  created_at: string
  // Embed de la mesa (table_number) vía la FK table_id.
  tables: { table_number: number } | null
}
