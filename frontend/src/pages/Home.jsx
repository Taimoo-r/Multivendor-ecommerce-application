import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiCreditCard, FiHeadphones, FiRotateCcw, FiTruck } from "react-icons/fi";
import { useTitle } from "../lib/hooks";
import { CATEGORIES } from "../lib/constants";
import { Banner, Img, SectionHead } from "../components/ui/primitives";
import { useGetEventsQuery, useGetHomeQuery, useGetShopsQuery } from "../store/api";
import { EventCard, ShopCard } from "../components/product/Cards";
import Row from "../components/product/Row";

const SLIDES = [
  {
    bg: "#0a1a1c",
    dark: true,
    eyebrow: "Audio, tuned",
    title: "Hear every detail.",
    text: "Noise-cancelling headphones and portable speakers from Northline Audio, from $79.",
    cta: "Shop audio",
    to: "/products?category=Electronics",
    img: "/banners/banner-audio.jpg",
    pos: "50% 62%",
  },
  {
    bg: "#eceff3",
    dark: false,
    eyebrow: "Home & Living",
    title: "Slow down at home.",
    text: "Linen, stoneware and warm light from Hearth & Co. Pieces made to stay.",
    cta: "Shop home",
    to: "/products?category=Home %26 Living",
    img: "/banners/banner-home.jpg",
    pos: "50% 50%",
  },
  {
    bg: "#0f2c36",
    dark: true,
    eyebrow: "Trail season",
    title: "Gear for the long way round.",
    text: "Boots, tents and packs from Stride Lab. Up to 25% off this month.",
    cta: "Shop outdoors",
    to: "/products?category=Sports %26 Outdoors",
    img: "/banners/banner-outdoor.jpg",
    pos: "50% 55%",
  },
];

const HERO_SIZES = "(min-width: 1024px) 34vw, (min-width: 640px) 50vw, 100vw";

// Only the visible slide is in the DOM, so the other banners are not downloaded
// until they are shown.
const Hero = () => {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = SLIDES[i];

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((n) => (n + 1) % SLIDES.length), 6500);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        key={slide.title}
        className="relative grid sm:grid-cols-[1fr_1.05fr] min-h-[400px] lg:min-h-[420px] anim-fade"
        style={{ background: slide.bg, color: slide.dark ? "#fff" : "#0a1a1c" }}
      >
        <div className="order-2 sm:order-1 p-6 sm:p-9 lg:p-11 flex flex-col justify-center">
          <span className="text-xs font-bold uppercase tracking-[.14em] opacity-70">{slide.eyebrow}</span>
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold mt-3 leading-[1.05]">{slide.title}</h1>
          <p className="mt-3.5 text-[15px] opacity-80 max-w-sm">{slide.text}</p>
          <div className="mt-6">
            <Link
              to={slide.to}
              className={`btn btn-lg ${slide.dark ? "bg-white text-ink hover:bg-surface" : "btn-primary"}`}
            >
              {slide.cta} <FiArrowRight />
            </Link>
          </div>
        </div>
        <div className="order-1 sm:order-2 relative h-52 sm:h-auto">
          <Banner
            src={slide.img}
            sizes={HERO_SIZES}
            priority={i === 0}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: slide.pos }}
          />
        </div>
      </div>
      <div className="absolute bottom-4 left-6 sm:left-9 lg:left-11 flex gap-2 z-10">
        {SLIDES.map((s, idx) => (
          <button
            key={s.title}
            onClick={() => setI(idx)}
            aria-label={`Show slide ${idx + 1}`}
            aria-current={idx === i}
            className={`h-1.5 rounded-full transition-all ${idx === i ? "w-8 bg-accent" : "w-3 bg-current opacity-30"}`}
            style={{ color: SLIDES[i].dark ? "#fff" : "#0a1a1c" }}
          />
        ))}
      </div>
    </div>
  );
};

const PromoTile = ({ to, img, eyebrow, title }) => (
  <Link to={to} className="relative rounded-2xl overflow-hidden block group min-h-[200px] flex-1 bg-surface-2">
    <Banner src={img} sizes="(min-width: 1024px) 30vw, 50vw" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500" />
    <div className="absolute inset-0 bg-ink/35" />
    <div className="relative h-full p-5 flex flex-col justify-end text-white">
      <span className="text-[11px] font-bold uppercase tracking-[.14em] opacity-80">{eyebrow}</span>
      <h3 className="text-xl font-bold mt-1 leading-tight">{title}</h3>
      <span className="inline-flex items-center gap-1 text-sm font-semibold mt-2 group-hover:gap-2 transition-all">
        Shop now <FiArrowRight size={15} />
      </span>
    </div>
  </Link>
);

const Trust = () => {
  const items = [
    [FiTruck, "Free shipping", "On each shop's items over $50"],
    [FiRotateCcw, "30-day returns", "Easy returns, prepaid labels"],
    [FiCreditCard, "Secure payments", "Cards via Stripe, or pay on delivery"],
    [FiHeadphones, "Real support", "Replies within a business day"],
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-5 gap-x-6 py-6 border-b border-line">
      {items.map(([Icon, t, s]) => (
        <div key={t} className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-surface grid place-items-center shrink-0">
            <Icon size={18} />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">{t}</p>
            <p className="text-xs text-slate mt-0.5">{s}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const CategoryCircles = ({ images = {} }) => (
  <div className="grid grid-cols-4 sm:grid-cols-8 gap-x-3 gap-y-5">
    {CATEGORIES.map((c) => {
      return (
        <Link key={c} to={`/products?category=${encodeURIComponent(c)}`} className="group text-center">
          <div className="aspect-square rounded-full bg-surface overflow-hidden border border-transparent group-hover:border-ink transition">
            <Img name={images[c]} alt="" sizes="(min-width: 640px) 140px, 25vw" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
          </div>
          <span className="block mt-2.5 text-xs sm:text-[13px] font-medium leading-tight">{c}</span>
        </Link>
      );
    })}
  </div>
);

const CategoryTile = ({ image, tint, title, to }) => {
  return (
    <Link
      to={to}
      className="rounded-2xl overflow-hidden grid grid-cols-[1fr_1fr] min-h-[200px] group"
      style={{ background: tint }}
    >
      <div className="p-6 flex flex-col justify-between">
        <h3 className="text-xl font-bold leading-tight max-w-[10ch]">{title}</h3>
        <span className="btn btn-primary btn-sm self-start group-hover:bg-accent">Shop now</span>
      </div>
      <div className="relative">
        <Img name={image} alt="" sizes="(min-width: 768px) 16vw, 50vw" className="absolute inset-0 w-full h-full object-cover mix-blend-multiply" />
      </div>
    </Link>
  );
};

export default function Home() {
  useTitle("");
  const { data: home, isLoading: loading } = useGetHomeQuery();
  const { data: events = [] } = useGetEventsQuery();
  const { data: shops = [] } = useGetShopsQuery();
  const h = home || {};
  const img = h.categoryImages || {};
  const live = events.filter((e) => e.status === "Running").slice(0, 4);

  return (
    <div className="container-x pt-5">
      <section className="grid lg:grid-cols-[2fr_1fr] gap-4">
        <Hero />
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
          <PromoTile
            to="/products?category=Kitchen %26 Coffee"
            img="/banners/banner-coffee.jpg"
            eyebrow="Slow mornings"
            title="Coffee gear, from $18"
          />
          <PromoTile
            to="/products?category=Electronics"
            img="/banners/banner-tech.jpg"
            eyebrow="Desk upgrades"
            title="Keyboards, cameras & more"
          />
        </div>
      </section>

      <Trust />

      <section className="pt-10">
        <SectionHead title="Explore popular categories" to="/products" />
        <CategoryCircles images={img} />
      </section>

      <section className="pt-14">
        <SectionHead title="Today's best deals" subtitle="The biggest discounts across the marketplace" to="/products?sort=discount" />
        <Row products={h.deals || []} loading={loading} />
      </section>

      {live.length > 0 && (
        <section className="pt-14">
          <SectionHead title="Live sales" subtitle="Limited-stock deals that end soon" to="/events" />
          <div className="grid lg:grid-cols-2 gap-4">
            {live.slice(0, 2).map((e) => (
              <EventCard key={e._id} event={e} />
            ))}
          </div>
        </section>
      )}

      <section className="pt-14 grid md:grid-cols-3 gap-4">
        <CategoryTile image={img.Shoes} tint="#f1e7dc" title="Sneaker season" to="/products?category=Shoes" />
        <CategoryTile image={img["Beauty & Care"]} tint="#e3edf5" title="The glow edit" to="/products?category=Beauty %26 Care" />
        <CategoryTile image={img.Fashion} tint="#e8eee2" title="Layers for autumn" to="/products?category=Fashion" />
      </section>

      <section className="pt-14">
        <SectionHead title="Top in Electronics" to="/products?category=Electronics" />
        <Row products={h.electronics || []} loading={loading} />
      </section>

      <section className="pt-14">
        <SectionHead title="Style & Fashion" subtitle="Wardrobe staples and footwear" to="/products?category=Fashion" />
        <Row products={h.style || []} loading={loading} />
      </section>

      <section className="pt-14">
        <SectionHead title="Official brand stores" subtitle="Independent shops, vetted by us" to="/shops" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {shops.slice(0, 8).map((s) => (
            <ShopCard key={s._id} shop={s} />
          ))}
        </div>
      </section>

      <section className="pt-14">
        <SectionHead title="Home, kitchen & coffee" to="/products?category=Home %26 Living" />
        <Row products={h.home || []} loading={loading} />
      </section>

      <section className="pt-14">
        <SectionHead title="Best sellers" subtitle="What everyone is buying" to="/best-selling" />
        <Row products={h.best || []} loading={loading} />
      </section>

      <section className="pt-14">
        <SectionHead title="New arrivals" to="/products?sort=new" />
        <Row products={h.fresh || []} loading={loading} />
      </section>

      <section className="mt-16 rounded-2xl bg-ink text-white overflow-hidden grid md:grid-cols-[1.3fr_1fr]">
        <div className="p-8 sm:p-12">
          <span className="text-xs font-bold uppercase tracking-[.14em] text-white/60">For sellers</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 leading-tight">Open your shop in minutes.</h2>
          <p className="text-white/75 mt-3 max-w-md">
            List products, run flash sales and issue your own coupons. You keep 90% of every order, with no monthly fee.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/shop-create" className="btn btn-lg bg-white text-ink hover:bg-surface">Start selling</Link>
            <Link to="/shop-login" className="btn btn-lg border-white/30 text-white hover:border-white">Seller login</Link>
          </div>
        </div>
        <div className="hidden md:block relative min-h-[260px]">
          <Banner src="/banners/banner-fashion.jpg" sizes="40vw" className="absolute inset-0 w-full h-full object-cover opacity-90" />
        </div>
      </section>
    </div>
  );
}
