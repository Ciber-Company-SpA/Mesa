"use client";

import Image from "next/image";
import { Search, ShoppingCart, Star, Flame, Clock } from "lucide-react";

/* ============================================================
   1) TIPOS
   ============================================================ */
type Size = { name: string; price: string };

type Product = {
  name: string;
  desc: string;
  image: string;
  accent: "orange" | "gold";
  sizes: Size[];
};

type Category = { title: string; items: Product[] };

type Recommended = {
  name: string;
  price: string;
  image: string;
  tag?: string;
};

type MenuData = {
  restaurant: {
    name: string;
    logo?: string; // url opcional; si no hay, se usa la insignia con degradado
    rating: string;
    meta: string;
    cartCount: number;
    cartTotal: string;
  };
  categories: string[];
  offer: {
    name: string;
    price: string;
    oldPrice: string;
    discount: string;
    countdown: string;
    image: string;
  };
  recommended: Recommended[];
  menu: Category[];
};

/* ============================================================
   2) DATOS — editá platos, precios y fotos acá
   ============================================================ */
const DATA: MenuData = {
  restaurant: {
    name: "La Parrilla de Benja",
    logo: "", // ej: "/logo.png"
    rating: "4.8",
    meta: "Open · 25-35 min",
    cartCount: 2,
    cartTotal: "$6.500",
  },
  categories: ["Recomendados", "Ofertas", "Pizzas", "Refrescos"],
  offer: {
    name: "Combo Pizza XL + Café",
    price: "$7.000",
    oldPrice: "$11.000",
    discount: "-36% HOY",
    countdown: "Termina en 02:14",
    image:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80",
  },
  recommended: [
    {
      name: "Pizza",
      price: "$7.000",
      tag: "Top ventas",
      image:
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&q=80",
    },
    {
      name: "Coffee",
      price: "$7.000",
      tag: "Top ventas",
      image:
        "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&q=80",
    },
  ],
  menu: [
    {
      title: "Pizzas",
      items: [
        {
          name: "Pizza",
          desc: "Masa artesanal, salsa de la casa.",
          accent: "orange",
          image:
            "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80",
          sizes: [
            { name: "Individual", price: "$2.500" },
            { name: "Familiar", price: "$4.000" },
            { name: "XL", price: "$7.000" },
          ],
        },
      ],
    },
    {
      title: "Refrescos",
      items: [
        {
          name: "Refrescos",
          desc: "Bien fríos, con hielo.",
          accent: "gold",
          image:
            "https://images.unsplash.com/photo-1437418747212-8d9709afab22?w=800&q=80",
          sizes: [
            { name: "Individual", price: "$2.500" },
            { name: "Familiar", price: "$4.000" },
            { name: "XL", price: "$7.000" },
          ],
        },
      ],
    },
  ],
};

/* ============================================================
   3) COMPONENTE
   ============================================================ */
export default function MenuHome({ data = DATA }: { data?: MenuData }) {
  const { restaurant: r } = data;

  return (
    <div className="mx-auto w-full max-w-[430px] bg-[#120c0a] text-white font-sans">
      {/* Barra superior */}
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          aria-label="Buscar"
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10"
        >
          <Search size={18} />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#FF6A2B] to-[#C0341A] text-lg font-bold">
            {r.logo ? (
              <Image src={r.logo} alt={r.name} width={36} height={36} />
            ) : (
              r.name.charAt(0)
            )}
          </div>
          <span className="text-base font-semibold">{r.name}</span>
        </div>

        <button
          aria-label="Carrito"
          className="relative grid h-9 w-9 place-items-center rounded-full bg-white/10"
        >
          <ShoppingCart size={18} />
          <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[#FF6A2B] text-[10px] font-semibold">
            {r.cartCount}
          </span>
        </button>
      </header>

      <div className="flex items-center justify-center gap-1.5 px-4">
        <Star size={13} className="text-[#FFB23E]" fill="#FFB23E" />
        <span className="text-xs text-[#c9a98f]">
          {r.rating} · {r.meta}
        </span>
      </div>

      {/* Categorías */}
      <nav className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
        {data.categories.map((c, i) => (
          <button
            key={c}
            className={
              "whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] " +
              (i === 0
                ? "bg-gradient-to-br from-[#FF6A2B] to-[#E0431C] font-semibold text-white"
                : "bg-white/[0.07] text-[#e7d6c9]")
            }
          >
            {c}
          </button>
        ))}
      </nav>

      {/* Oferta destacada */}
      <section className="relative mx-4 mb-4 h-[170px] overflow-hidden rounded-2xl">
        <Image
          src={data.offer.image}
          alt={data.offer.name}
          fill
          sizes="430px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#120c0a]/30 to-[#120c0a]/90" />
        <div className="absolute left-3 right-3 top-3 flex justify-between">
          <span className="rounded-full bg-[#FF6A2B] px-2.5 py-1 text-[11px] font-bold">
            {data.offer.discount}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-[#FFB23E]">
            <Clock size={12} />
            {data.offer.countdown}
          </span>
        </div>
        <div className="absolute bottom-3 left-3.5 right-3.5">
          <p className="text-[19px] font-bold leading-tight">
            {data.offer.name}
          </p>
          <div className="mt-1 flex items-center gap-2.5">
            <span className="text-xl font-bold">{data.offer.price}</span>
            <span className="text-[13px] text-white/60 line-through">
              {data.offer.oldPrice}
            </span>
          </div>
        </div>
      </section>

      {/* Recomendados */}
      <div className="mb-2.5 flex items-center justify-between px-4">
        <span className="flex items-center gap-1.5 text-[17px] font-semibold">
          <Flame size={18} className="text-[#FF6A2B]" /> Recomendados
        </span>
        <span className="text-xs text-[#c9a98f]">Ver todo</span>
      </div>

      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
        {data.recommended.map((p) => (
          <article
            key={p.name}
            className="w-[158px] flex-shrink-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1c1410]"
          >
            <div className="relative h-[110px]">
              <Image src={p.image} alt={p.name} fill sizes="158px" className="object-cover" />
              {p.tag && (
                <span className="absolute left-2 top-2 rounded-full bg-[#FF6A2B] px-2.5 py-0.5 text-[10px] font-bold">
                  {p.tag}
                </span>
              )}
            </div>
            <div className="px-3 pb-3 pt-2.5">
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="mt-1.5 text-base font-bold text-[#FFB23E]">
                {p.price}
              </p>
            </div>
          </article>
        ))}
      </div>

      {/* Secciones del menú */}
      {data.menu.map((cat) => (
        <section key={cat.title}>
          <h2 className="mb-3 mt-5 px-4 text-[17px] font-semibold">
            {cat.title}
          </h2>
          {cat.items.map((item) => {
            const accent =
              item.accent === "orange"
                ? "border-[#FF6A2B]/30 bg-[#FF6A2B]/[0.12]"
                : "border-[#FFB23E]/30 bg-[#FFB23E]/[0.12]";
            return (
              <article
                key={item.name}
                className="mx-4 mb-3.5 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1c1410]"
              >
                <div className="relative h-[150px]">
                  <Image src={item.image} alt={item.name} fill sizes="400px" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#1c1410]/90" />
                  <div className="absolute bottom-2.5 left-3.5 right-3.5">
                    <p className="text-[17px] font-bold">{item.name}</p>
                    <p className="mt-0.5 text-xs text-[#d8c2b3]">{item.desc}</p>
                  </div>
                </div>
                <div className="flex gap-2 p-2.5">
                  {item.sizes.map((s) => (
                    <button
                      key={s.name}
                      className={
                        "flex-1 rounded-[10px] border px-1.5 py-2 text-center text-xs text-[#e7d6c9] " +
                        accent
                      }
                    >
                      {s.name}
                      <b className="mt-0.5 block text-sm font-bold text-white">
                        {s.price}
                      </b>
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      ))}

      {/* Barra de pedido */}
      <div className="sticky bottom-0 p-4">
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#FF6A2B] to-[#E0431C] px-4 py-3.5 font-semibold text-white">
          <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs">
            {r.cartCount}
          </span>
          Ver pedido · {r.cartTotal}
        </button>
      </div>
    </div>
  );
}
