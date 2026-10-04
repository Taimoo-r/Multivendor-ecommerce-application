import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiSliders, FiX, FiSearch } from "react-icons/fi";
import { Breadcrumbs, Drawer, Empty, Stars } from "../components/ui/primitives";
import { ProductGrid, ProductSkeletons } from "../components/product/Cards";
import { CATEGORIES } from "../lib/constants";
import { percentOff, money } from "../lib/format";
import { useCatalog, useTitle } from "../lib/hooks";

const PAGE = 20;
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

const sorters = {
  featured: (a, b) => b.sold_out + (b.ratings || 0) * 40 - (a.sold_out + (a.ratings || 0) * 40),
  best: (a, b) => b.sold_out - a.sold_out,
  new: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  "price-asc": (a, b) => a.discountPrice - b.discountPrice,
  "price-desc": (a, b) => b.discountPrice - a.discountPrice,
  rating: (a, b) => (b.ratings || 0) - (a.ratings || 0),
  discount: (a, b) => percentOff(b.originalPrice, b.discountPrice) - percentOff(a.originalPrice, a.discountPrice),
};

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
  const { products, shops, status } = useCatalog();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

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
    setPage(1);
  };

  const base = useMemo(() => {
    const term = q.toLowerCase();
    return products.filter((p) => {
      if (!term) return true;
      return [p.name, p.category, p.tags, p.shop?.name, p.description].some(
        (f) => f && f.toLowerCase().includes(term)
      );
    });
  }, [products, q]);

  const filtered = useMemo(() => {
    const lo = min === "" ? 0 : Number(min);
    const hi = max === "" ? Infinity : Number(max);
    return base
      .filter((p) => !category || p.category === category)
      .filter((p) => !shop || p.shopId === shop)
      .filter((p) => p.discountPrice >= lo && p.discountPrice <= hi)
      .filter((p) => !rating || (p.ratings || 0) >= rating)
      .filter((p) => !onSale || percentOff(p.originalPrice, p.discountPrice) > 0)
      .filter((p) => !inStock || p.stock > 0)
      .sort(sorters[sort] || sorters.featured);
  }, [base, category, shop, min, max, rating, onSale, inStock, sort]);

  const catCounts = useMemo(() => {
    const m = {};
    base.forEach((p) => (m[p.category] = (m[p.category] || 0) + 1));
    return m;
  }, [base]);

  const visible = filtered.slice(0, page * PAGE);
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
        <Check checked={!category} onChange={() => set({ category: "" })} count={base.length}>
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

  const loading = status === "idle" || status === "loading";

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: preset?.title || "Products", to: category || q ? "/products" : undefined }, ...(category ? [{ label: category }] : [])]} />

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
          {preset?.subtitle && <p className="text-slate mt-1">{preset.subtitle}</p>}
          <p className="text-sm text-slate mt-1 num">
            {loading ? "Loading…" : `${filtered.length} ${filtered.length === 1 ? "product" : "products"}`}
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
          ) : filtered.length === 0 ? (
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
              <ProductGrid products={visible} cols={GRID} />
              {visible.length < filtered.length && (
                <div className="text-center mt-12">
                  <p className="text-sm text-slate mb-3 num">
                    Showing {visible.length} of {filtered.length}
                  </p>
                  <button onClick={() => setPage((p) => p + 1)} className="btn btn-outline btn-lg">
                    Show more
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
            Show {filtered.length} products
          </button>
        }
      >
        <div className="px-5">{filters}</div>
      </Drawer>
    </div>
  );
}
