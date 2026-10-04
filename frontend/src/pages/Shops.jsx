import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiMapPin, FiStar } from "react-icons/fi";
import { Breadcrumbs, Empty, Img, PageLoader } from "../components/ui/primitives";
import { EventCard, ProductGrid, ShopCard } from "../components/product/Cards";
import { api } from "../lib/api";
import { shortDate } from "../lib/format";
import { useCatalog, useTitle } from "../lib/hooks";

export function Shops() {
  useTitle("Brand stores");
  const { shops, status } = useCatalog();
  const loading = status === "idle" || status === "loading";

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Brand stores" }]} />
      <div className="pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Brand stores</h1>
        <p className="text-slate mt-1.5">Independent shops on VendorZone. Every one is vetted before it can sell.</p>
      </div>
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-[220px] rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shops.map((s) => (
            <Link key={s._id} to={`/shop/${s._id}`} className="card p-5 hover:border-ink transition group flex flex-col">
              <div className="flex items-center gap-4">
                <Img name={s.avatar} alt="" className="w-16 h-16 rounded-xl object-cover bg-surface" />
                <div className="min-w-0">
                  <h2 className="font-bold text-lg truncate group-hover:underline">{s.name}</h2>
                  <p className="text-xs text-slate flex items-center gap-1 truncate"><FiMapPin size={12} /> {s.address}</p>
                </div>
              </div>
              <p className="text-sm text-slate mt-4 line-clamp-3 flex-1">{s.description}</p>
              <div className="flex items-center gap-5 text-sm mt-4 pt-4 border-t border-line num">
                <span className="flex items-center gap-1.5 font-semibold">
                  <FiStar className="text-[#f5a524] fill-[#f5a524]" size={14} /> {s.stats?.rating ? s.stats.rating.toFixed(1) : "–"}
                </span>
                <span><b>{s.stats?.products}</b> <span className="text-slate">products</span></span>
                <span><b>{s.stats?.sold}</b> <span className="text-slate">sold</span></span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ShopPage() {
  const { id } = useParams();
  const { products, events, shops, status } = useCatalog();
  const [tab, setTab] = useState("products");
  const [shop, setShop] = useState(null);
  const [missing, setMissing] = useState(false);

  // prefer the catalogue copy; fall back to the API for direct links before it loads
  const fromCatalog = shops.find((s) => s._id === id);
  useEffect(() => {
    setMissing(false);
    if (fromCatalog) return setShop(fromCatalog);
    if (status === "idle" || status === "loading") return;
    api
      .get(`/shop/get-shop-info/${id}`)
      .then(({ data }) => setShop({ ...data.shop, stats: data.stats }))
      .catch(() => setMissing(true));
  }, [id, fromCatalog, status]);

  useTitle(shop?.name);
  useResetTab(id, setTab);

  if (missing) {
    return (
      <div className="container-x">
        <Empty title="Shop not found" action={<Link to="/shops" className="btn btn-primary">All brand stores</Link>} />
      </div>
    );
  }
  if (!shop) return <PageLoader />;

  const mine = products.filter((p) => p.shopId === id);
  const sales = events.filter((e) => e.shopId === id && e.status !== "Ended");
  const reviews = mine
    .flatMap((p) => (p.reviews || []).map((r) => ({ ...r, product: p })))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 12);

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Brand stores", to: "/shops" }, { label: shop.name }]} />

      <header className="card p-6 sm:p-8 flex flex-col sm:flex-row gap-6 sm:items-center">
        <Img name={shop.avatar} alt="" className="w-24 h-24 rounded-2xl object-cover bg-surface shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">{shop.name}</h1>
          <p className="text-sm text-slate flex items-center gap-1.5 mt-1"><FiMapPin size={14} /> {shop.address}</p>
          <p className="text-[15px] text-ink-2 mt-3 max-w-2xl">{shop.description}</p>
        </div>
        <dl className="grid grid-cols-3 sm:grid-cols-1 gap-4 sm:gap-2 text-center sm:text-left sm:border-l sm:border-line sm:pl-8 num">
          <div><dt className="text-xs text-muted">Rating</dt><dd className="font-bold text-lg flex items-center sm:justify-start justify-center gap-1"><FiStar className="text-[#f5a524] fill-[#f5a524]" size={16} /> {shop.stats?.rating ? shop.stats.rating.toFixed(1) : "–"}</dd></div>
          <div><dt className="text-xs text-muted">Products</dt><dd className="font-bold text-lg">{shop.stats?.products ?? mine.length}</dd></div>
          <div><dt className="text-xs text-muted">Sold</dt><dd className="font-bold text-lg">{shop.stats?.sold ?? 0}</dd></div>
        </dl>
      </header>

      <div role="tablist" className="flex gap-7 border-b border-line mt-8 overflow-x-auto no-scrollbar">
        {[
          ["products", `Products (${mine.length})`],
          ["sales", `Live sales (${sales.length})`],
          ["reviews", "Reviews"],
          ["about", "About"],
        ].map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`pb-3 text-[15px] font-semibold whitespace-nowrap border-b-2 -mb-px ${tab === k ? "border-ink text-ink" : "border-transparent text-slate hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="py-8">
        {tab === "products" &&
          (mine.length ? <ProductGrid products={mine} /> : <Empty title="No products yet" text="This shop hasn't listed anything." />)}
        {tab === "sales" &&
          (sales.length ? (
            <div className="grid lg:grid-cols-2 gap-4">{sales.map((e) => <EventCard key={e._id} event={e} />)}</div>
          ) : (
            <Empty title="No live sales" text="Check back soon for deals from this shop." />
          ))}
        {tab === "reviews" &&
          (reviews.length ? (
            <ul className="grid md:grid-cols-2 gap-4">
              {reviews.map((r, i) => (
                <li key={i} className="card p-5">
                  <div className="flex items-center gap-3">
                    <Img name={r.user?.avatar} alt="" className="w-9 h-9 rounded-full object-cover bg-surface" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{r.user?.name}</p>
                      <p className="text-xs text-muted">{shortDate(r.createdAt)}</p>
                    </div>
                    <span className="ml-auto text-sm font-bold num flex items-center gap-1"><FiStar className="text-[#f5a524] fill-[#f5a524]" size={14} /> {r.rating}</span>
                  </div>
                  {r.comment && <p className="text-[15px] text-ink-2 mt-3">{r.comment}</p>}
                  <Link to={`/product/${r.product._id}`} className="text-xs text-link hover:underline mt-3 inline-block">on {r.product.name}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No reviews yet" />
          ))}
        {tab === "about" && (
          <div className="max-w-2xl space-y-3 text-[15px] text-ink-2">
            <p>{shop.description}</p>
            <p className="text-slate">Based in {shop.address}. Member since {shop.createdAt ? shortDate(shop.createdAt) : "recently"}.</p>
            <p className="text-slate">Ships within 1–2 business days. Returns accepted within 30 days.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// reset to the products tab when navigating between shops
function useResetTab(id, setTab) {
  useEffect(() => setTab("products"), [id, setTab]);
}
