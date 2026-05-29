import type { MenuTemplate } from "@/types/restaurant"

export type TemplateMeta = {
  id: MenuTemplate
  label: string
  description: string
  swatch: string
}

export type TemplateDesign = {
  mainClass: string
  overlayClass: string
  mesaText: string
  titleClass: string
  abiertoBadge: string
  stickyClass: string
  pillActive: string
  pillInactive: string
  catDivider: string
  catAccentBar: string
  catTitle: string
  catCount: string
  card: string
  cardImageBg: string
  cardCat: string
  cardName: string
  cardPrice: string
  cardDesc: string
  emptyCard: string
  emptyTitle: string
}

export const MENU_TEMPLATES: TemplateMeta[] = [
  {
    id: "noche",
    label: "Noche",
    description: "Fondo oscuro con detalles naranjas. Vista clásica y cálida.",
    swatch: "linear-gradient(180deg, #1c1917 0%, #0c0a09 58%, #020617 100%)",
  },
  {
    id: "aurora",
    label: "Aurora",
    description: "Estilo tecnológico con destellos violeta y cian sobre fondo profundo.",
    swatch:
      "radial-gradient(circle at 15% 20%, rgba(91,33,182,0.45) 0%, transparent 50%), radial-gradient(circle at 85% 80%, rgba(6,182,212,0.3) 0%, transparent 50%), #090d16",
  },
  {
    id: "cyber-ruby",
    label: "Cyber Ruby",
    description: "Contraste enérgico con destellos magenta y azul marino oscuro.",
    swatch:
      "radial-gradient(circle at 85% 20%, rgba(217,70,239,0.45) 0%, transparent 50%), radial-gradient(circle at 15% 80%, rgba(29,78,216,0.35) 0%, transparent 50%), #090514",
  },
  {
    id: "eclipse",
    label: "Eclipse",
    description: "Negro profundo con un sutil resplandor gris plata. Minimalismo puro.",
    swatch:
      "radial-gradient(circle at 50% 10%, rgba(255,255,255,0.12) 0%, transparent 50%), #050507",
  },
]

export const TEMPLATE_IDS = MENU_TEMPLATES.map((t) => t.id) as [MenuTemplate, ...MenuTemplate[]]

const DESIGNS: Record<MenuTemplate, TemplateDesign> = {
  noche: {
    mainClass: "bg-stone-950 text-white",
    overlayClass:
      "bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.22),_transparent_34%),radial-gradient(circle_at_85%_12%,_rgba(120,53,15,0.34),_transparent_28%),linear-gradient(180deg,_#1c1917_0%,_#0c0a09_58%,_#020617_100%)]",
    mesaText: "text-orange-200/80",
    titleClass: "text-white",
    abiertoBadge: "bg-white/10 text-orange-100 ring-1 ring-white/10 backdrop-blur",
    stickyClass: "",
    pillActive: "bg-orange-500 text-stone-950 shadow-orange-500/25",
    pillInactive: "bg-white/10 text-stone-200 ring-1 ring-white/10 backdrop-blur",
    catDivider: "border-white/5",
    catAccentBar:
      "bg-gradient-to-b from-orange-400 to-orange-600 shadow-[0_0_8px_rgba(249,115,22,0.4)]",
    catTitle: "text-white",
    catCount: "bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20",
    card: "bg-white/10 ring-1 ring-white/10 backdrop-blur",
    cardImageBg: "bg-gradient-to-br from-stone-900 via-stone-800 to-orange-950",
    cardCat: "text-orange-200/80",
    cardName: "text-white",
    cardPrice: "text-orange-200",
    cardDesc: "text-stone-300",
    emptyCard: "bg-white/10 ring-1 ring-white/10 backdrop-blur",
    emptyTitle: "text-white",
  },
  eclipse: {
    mainClass: "bg-[#050507] text-white",
    overlayClass:
      "bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.06)_0%,transparent_50%)]",
    mesaText: "text-zinc-500",
    titleClass: "text-white tracking-wide",
    abiertoBadge: "bg-white/[0.02] text-zinc-300 ring-1 ring-white/5 backdrop-blur-xl",
    stickyClass: "",
    pillActive: "bg-white text-stone-950 shadow-white/10",
    pillInactive: "bg-white/[0.02] text-zinc-300 ring-1 ring-white/5 backdrop-blur-xl",
    catDivider: "border-white/5",
    catAccentBar:
      "bg-gradient-to-b from-zinc-300 to-zinc-600 shadow-[0_0_8px_rgba(255,255,255,0.2)]",
    catTitle: "text-white",
    catCount: "bg-white/[0.03] text-zinc-300 ring-1 ring-white/5",
    card: "bg-white/[0.02] ring-1 ring-white/5 backdrop-blur-xl",
    cardImageBg: "bg-gradient-to-br from-zinc-900 via-zinc-950 to-black",
    cardCat: "text-zinc-500",
    cardName: "text-white",
    cardPrice: "text-zinc-200",
    cardDesc: "text-zinc-400",
    emptyCard: "bg-white/[0.02] ring-1 ring-white/5 backdrop-blur-xl",
    emptyTitle: "text-white",
  },
  "cyber-ruby": {
    mainClass: "bg-[#090514] text-white",
    overlayClass:
      "bg-[radial-gradient(circle_at_85%_20%,rgba(217,70,239,0.18)_0%,transparent_50%),radial-gradient(circle_at_15%_80%,rgba(29,78,216,0.15)_0%,transparent_50%)]",
    mesaText: "text-fuchsia-300/80",
    titleClass: "text-white tracking-wide",
    abiertoBadge: "bg-fuchsia-950/20 text-fuchsia-200 ring-1 ring-fuchsia-500/10 backdrop-blur-xl",
    stickyClass: "",
    pillActive: "bg-fuchsia-500 text-white shadow-fuchsia-500/30",
    pillInactive: "bg-fuchsia-950/20 text-fuchsia-100 ring-1 ring-fuchsia-500/10 backdrop-blur-xl",
    catDivider: "border-fuchsia-500/10",
    catAccentBar:
      "bg-gradient-to-b from-fuchsia-400 to-blue-600 shadow-[0_0_8px_rgba(217,70,239,0.5)]",
    catTitle: "text-white",
    catCount: "bg-fuchsia-500/10 text-fuchsia-300 ring-1 ring-fuchsia-500/20",
    card: "bg-fuchsia-950/20 ring-1 ring-fuchsia-500/10 backdrop-blur-xl",
    cardImageBg: "bg-gradient-to-br from-fuchsia-950 via-slate-900 to-blue-950",
    cardCat: "text-fuchsia-400/70",
    cardName: "text-white",
    cardPrice: "text-fuchsia-200",
    cardDesc: "text-fuchsia-100/60",
    emptyCard: "bg-fuchsia-950/20 ring-1 ring-fuchsia-500/10 backdrop-blur-xl",
    emptyTitle: "text-white",
  },
  aurora: {
    mainClass: "bg-[#090d16] text-white",
    overlayClass:
      "bg-[radial-gradient(circle_at_15%_20%,rgba(91,33,182,0.25)_0%,transparent_50%),radial-gradient(circle_at_85%_80%,rgba(6,182,212,0.18)_0%,transparent_50%)]",
    mesaText: "text-violet-300/80",
    titleClass: "text-white",
    abiertoBadge: "bg-white/5 text-cyan-200 ring-1 ring-white/10 backdrop-blur-xl",
    stickyClass: "",
    pillActive: "bg-violet-500 text-white shadow-violet-500/25",
    pillInactive: "bg-white/5 text-slate-200 ring-1 ring-white/10 backdrop-blur-xl",
    catDivider: "border-white/10",
    catAccentBar:
      "bg-gradient-to-b from-violet-400 to-cyan-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]",
    catTitle: "text-white",
    catCount: "bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/20",
    card: "bg-white/5 ring-1 ring-white/10 backdrop-blur-xl",
    cardImageBg: "bg-gradient-to-br from-slate-900 via-slate-800 to-violet-950",
    cardCat: "text-cyan-200/80",
    cardName: "text-white",
    cardPrice: "text-violet-200",
    cardDesc: "text-slate-300",
    emptyCard: "bg-white/5 ring-1 ring-white/10 backdrop-blur-xl",
    emptyTitle: "text-white",
  },
}

export function getTemplateDesign(template: MenuTemplate | null | undefined): TemplateDesign {
  return DESIGNS[template ?? "noche"] ?? DESIGNS.noche
}
