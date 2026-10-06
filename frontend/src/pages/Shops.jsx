import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiMapPin, FiStar } from "react-icons/fi";
import { Breadcrumbs, Empty, Img, PageLoader, Spinner } from "../components/ui/primitives";
import { EventCard, ProductGrid, ProductSkeletons } from "../components/product/Cards";
import { shortDate } from "../lib/format";
import { useTitle } from "../lib/hooks";
import {
  useGetProductsInfiniteQuery,
  useGetShopEventsQuery,
  useGetShopQuery,
  useGetShopReviewsQuery,
  useGetShopsQuery,
} from "../store/api";

export function Shops() {
  useTitle("Brand stores");
  const { data: shops = [], isLoading: loading } = useGetShopsQuery();

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
                <Img name={s.avatar} alt="" sizes="64px" className="w-16 h-16 rounded-xl object-cover bg-surface" />
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
  const [tab, setTab] = useState("products");
  const { data, isLoading, isError } = useGetShopQuery(id);
  const shop = data ? { ...data.shop, stats: data.stats } : null;

  // each tab loads its own data, and only once it is opened (except the default one)
  const products = useGetProductsInfiniteQuery({ shop: id, sort: "best", limit: 24 });
  const mine = useMemo(() => (products.data?.pages || []).flatMap((pg) => pg.products), [products.data]);
  const { data: shopEvents = [] } = useGetShopEventsQuery(id);
  const sales = shopEvents.filter((e) => e.status !== "Ended");
  const { data: shopReviews = [] } = useGetShopReviewsQuery(id, { skip: tab !== "reviews" });
  const reviews = shopReviews.map((r) => ({ ...r.review, product: r.product }));

  useTitle(shop?.name);
  useResetTab(id, setTab);

  if (isError) {
    return (
      <div className="container-x">
        <Empty title="Shop not found" action={<Link to="/shops" className="btn btn-primary">All brand stores</Link>} />
      </div>
    );
  }
  if (isLoading || !shop) return <PageLoader />;

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Brand stores", to: "/shops" }, { label: shop.name }]} />

      <header className="card p-6 sm:p-8 flex flex-col sm:flex-row gap-6 sm:items-center">
        <Img name={shop.avatar} alt="" sizes="96px" priority className="w-24 h-24 rounded-2xl object-cover bg-surface shrink-0" />
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
          ["products", `Products (${shop.stats?.products ?? mine.length})`],
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
          (products.isLoading ? (
            <ProductSkeletons n={5} />
          ) : mine.length ? (
            <>
              <ProductGrid products={mine} />
              {products.hasNextPage && (
                <div className="text-center mt-10">
                  <button onClick={() => products.fetchNextPage()} disabled={products.isFetchingNextPage} className="btn btn-outline btn-lg">
                    {products.isFetchingNextPage ? <Spinner /> : "Show more"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <Empty title="No products yet" text="This shop hasn't listed anything." />
          ))}
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
                    <Img name={r.user?.avatar} alt="" sizes="36px" className="w-9 h-9 rounded-full object-cover bg-surface" />
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
