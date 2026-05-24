export type Waiter = {
  id: number
  name: string
  initials: string
  role: string
  status: "Disponible" | "Ocupado" | "Descanso"
  statusDetail: string
  tables: string[]
  rating: string
  efficiency: string
  color: string
}

export const INITIAL_WAITERS: Waiter[] = [
  {
    id: 1,
    name: "Alejandro Gomez",
    initials: "AG",
    role: "Mesero Principal",
    status: "Ocupado",
    statusDetail: "Servicio activo",
    tables: ["Mesa 4", "Mesa 7", "Mesa 9"],
    rating: "4.9",
    efficiency: "98%",
    color: "bg-orange-500 text-white",
  },
  {
    id: 2,
    name: "Sofia Valenzuela",
    initials: "SV",
    role: "Mesera Senior",
    status: "Disponible",
    statusDetail: "Disponible",
    tables: ["Mesa 1", "Mesa 2", "Mesa 3"],
    rating: "4.8",
    efficiency: "96%",
    color: "bg-emerald-500 text-white",
  },
  {
    id: 3,
    name: "Carlos Munoz",
    initials: "CM",
    role: "Mesero Junior",
    status: "Descanso",
    statusDetail: "En descanso (15 min)",
    tables: [],
    rating: "4.6",
    efficiency: "91%",
    color: "bg-stone-400 text-white",
  },
  {
    id: 4,
    name: "Camila Rojas",
    initials: "CR",
    role: "Mesera",
    status: "Ocupado",
    statusDetail: "Servicio activo",
    tables: ["Mesa 10", "Mesa 11", "Mesa 12"],
    rating: "5.0",
    efficiency: "99%",
    color: "bg-indigo-500 text-white",
  },
  {
    id: 5,
    name: "Sebastian Silva",
    initials: "SS",
    role: "Mesero",
    status: "Disponible",
    statusDetail: "Disponible",
    tables: ["Mesa 5", "Mesa 6", "Mesa 8"],
    rating: "4.7",
    efficiency: "94%",
    color: "bg-rose-500 text-white",
  },
]
