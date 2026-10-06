import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiSliders, FiX, FiSearch } from "react-icons/fi";
import { Breadcrumbs, Drawer, Empty, Spinner, Stars } from "../components/ui/primitives";
import { ProductGrid, ProductSkeletons } from "../components/product/Cards";
import { CATEGORIES } from "../lib/constants";
import { money } from "../lib/format";
import { useTitle } from "../lib/hooks";
import { useGetFacetsQuery, useGetProductsInfiniteQuery, useGetShopsQuery } from "../store/api";

const PAGE = 24;
// the filter sidebar takes a column, so the grid is one column narrower than full width
const GRID = "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4";

const SORTS = [
  ["featured", "Featured"],
  ["best", "Best selling"],
  ["new", "Newest"],
  ["price-asc", "Price: low to high"],
  ["price-desc", "Price: high to low"],
  ["rating", "Top rated"],
  ["discount", "Biggest discount"],
];

const Group = ({ title, children }) => (
  <fieldset className="py-5 border-b border-line last:border-0">
    <legend className="text-sm font-bold mb-3 float-left w-full">{title}</legend>
    <div className="clear-both">{children}</div>
  </fieldset>
);

const Check = ({ checked, onChange, children, count }) => (
  <label className="flex items-center gap-2.5 py-1.5 text-sm cursor-pointer group">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 rounded border-line accent-[#0a1a1c]"
    />
    <span className="flex-1 group-hover:text-ink text-ink-2">{children}</span>
    {count !== undefined && <span className="text-xs text-muted num">{count}</span>}
  </label>
);

export default function Products({ preset }) {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data: shops = [] } = useGetShopsQuery();

  const category = params.get("category") || "";
  const q = (params.get("q") || "").trim();
  const sort = params.get("sort") || preset?.sort || "featured";
  const shop = params.get("shop") || "";
  const min = params.get("min") || "";
  const max = params.get("max") || "";
  const rating = Number(params.get("rating") || 0);
  const onSale = params.get("sale") === "1";
  const inStock = params.get("stock") === "1";

  const title = preset?.title || (q ? `Results for "${q}"` : category || "All products");
  useTitle(title);

  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === "" || v === null || v === undefined || v === false) next.delete(k);
      else next.set(k, v === true ? "1" : v);
    });
    setParams(next, { replace: true });
  };

  // Filtering, sorting and paging happen on the server; the URL is the source of truth
  // and each filter combination is its own cached result.
  const query = useMemo(() => {
    const q2 = { sort, limit: PAGE };
    if (q) q2.q = q;
    if (category) q2.category = category;
    if (shop) q2.shop = shop;
    if (min !== "") q2.min = min;
    if (max !== "") q2.max = max;
    if (rating) q2.rating = rating;
    if (onSale) q2.sale = "1";
    if (inStock) q2.stock = "1";
    return q2;
  }, [q, category, shop, min, max, rating, onSale, inStock, sort]);

  const { data, isLoading, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, isError } =
    useGetProductsInfiniteQuery(query);
  const visible = useMemo(() => (data?.pages || []).flatMap((pg) => pg.products), [data]);
  const total = data?.pages?.[0]?.total ?? 0;
  const { data: catCounts = {} } = useGetFacetsQuery(q || undefined);
  const allCount = Object.values(catCounts).reduce((a, n) => a + n, 0);

  const shopName = shops.find((s) => s._id === shop)?.name;

  const chips = [
    category && [category, () => set({ category: "" })],
    shop && [shopName || "Shop", () => set({ shop: "" })],
    (min || max) && [`${min ? money(min) : "$0"} – ${max ? money(max) : "any"}`, () => set({ min: "", max: "" })],
    rating > 0 && [`${rating}★ & up`, () => set({ rating: "" })],
    onSale && ["On sale", () => set({ sale: "" })],
    inStock && ["In stock", () => set({ stock: "" })],
  ].filter(Boolean);

  const filters = (
    <div>
      <Group title="Category">
        <Check checked={!category} onChange={() => set({ category: "" })} count={allCount}>
          All categories
        </Check>
        {CATEGORIES.map((c) => (
          <Check key={c} checked={category === c} onChange={() => set({ category: category === c ? "" : c })} count={catCounts[c] || 0}>
            {c}
          </Check>
        ))}
      </Group>

      <Group title="Price">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Min"
            defaultValue={min}
            key={`min${min}`}
            onBlur={(e) => set({ min: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && set({ min: e.target.value })}
            className="field !h-10 num"
            aria-label="Minimum price"
          />
          <span className="text-muted">–</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Max"
            defaultValue={max}
            key={`max${max}`}
            onBlur={(e) => set({ max: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && set({ max: e.target.value })}
            className="field !h-10 num"
            aria-label="Maximum price"
          />
        </div>
      </Group>

      <Group title="Rating">
        {[4, 3].map((r) => (
          <label key={r} className="flex items-center gap-2.5 py-1.5 text-sm cursor-pointer">
            <input type="radio" name="rating" checked={rating === r} onChange={() => set({ rating: r })} className="w-4 h-4 accent-[#0a1a1c]" />
            <Stars value={r} /> <span className="text-slate">& up</span>
          </label>
        ))}
        {rating > 0 && (
          <button onClick={() => set({ rating: "" })} className="text-xs text-link mt-1 hover:underline">
            Clear rating
          </button>
        )}
      </Group>

      <Group title="Shop">
        {shops.map((s) => (
          <Check key={s._id} checked={shop === s._id} onChange={() => set({ shop: shop === s._id ? "" : s._id })}>
            {s.name}
          </Check>
        ))}
      </Group>

      <Group title="Availability">
        <Check checked={onSale} onChange={() => set({ sale: !onSale })}>On sale</Check>
        <Check checked={inStock} onChange={() => set({ stock: !inStock })}>In stock only</Check>
      </Group>
    </div>
  );

  const loading = isLoading || (isFetching && !isFetchingNextPage && visible.length === 0);

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: preset?.title || "Products", to: category || q ? "/products" : undefined }, ...(category ? [{ label: category }] : [])]} />

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
          {preset?.subtitle && <p className="text-slate mt-1">{preset.subtitle}</p>}
          <p className="text-sm text-slate mt-1 num">
            {loading ? "Loading…" : `${total} ${total === 1 ? "product" : "products"}`}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={() => setFiltersOpen(true)} className="btn btn-outline btn-sm lg:hidden">
            <FiSliders size={15} /> Filters{chips.length > 0 && ` (${chips.length})`}
          </button>
          <label className="flex items-center gap-2 text-sm flex-1 sm:flex-none">
            <span className="hidden sm:inline text-slate">Sort by</span>
            <select value={sort} onChange={(e) => set({ sort: e.target.value })} className="field !h-9 sm:!w-auto !text-[13px]">
              {SORTS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pb-5">
          {chips.map(([label, remove]) => (
            <button key={label} onClick={remove} className="inline-flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full bg-surface hover:bg-surface-2 text-[13px] font-medium">
              {label} <FiX size={14} />
            </button>
          ))}
          <button onClick={() => setParams(q ? { q } : {}, { replace: true })} className="text-[13px] font-semibold text-link hover:underline ml-1">
            Clear all
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-[240px_1fr] gap-10">
        <aside className="hidden lg:block border-t border-line">{filters}</aside>

        <section aria-live="polite">
          {loading ? (
            <ProductSkeletons n={8} cols={GRID} />
          ) : isError ? (
            <Empty
              icon={<FiSearch size={24} />}
              title="Couldn't load products"
              text="Check your connection and try again."
              action={<button onClick={() => window.location.reload()} className="btn btn-primary">Retry</button>}
            />
          ) : visible.length === 0 ? (
            <Empty
              icon={<FiSearch size={24} />}
              title="No products match"
              text="Try removing a filter or searching for something else."
              action={
                <button onClick={() => setParams({}, { replace: true })} className="btn btn-primary">
                  Clear filters
                </button>
              }
            />
          ) : (
            <>
              <div className={isFetching && !isFetchingNextPage ? "opacity-60 transition-opacity" : ""}>
                <ProductGrid products={visible} cols={GRID} />
              </div>
              {hasNextPage && (
                <div className="text-center mt-12">
                  <p className="text-sm text-slate mb-3 num">
                    Showing {visible.length} of {total}
                  </p>
                  <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="btn btn-outline btn-lg">
                    {isFetchingNextPage ? <Spinner /> : "Show more"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        side="left"
        footer={
          <button onClick={() => setFiltersOpen(false)} className="btn btn-primary btn-block">
            Show {total} products
          </button>
        }
      >
        <div className="px-5">{filters}</div>
      </Drawer>
    </div>
  );
}
