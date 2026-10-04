import { useState } from "react";
import { Link } from "react-router-dom";
import { FiChevronDown, FiHeart } from "react-icons/fi";
import { Breadcrumbs, Empty } from "../components/ui/primitives";
import { ProductGrid } from "../components/product/Cards";
import { FAQ as FAQ_ITEMS } from "../lib/constants";
import { useCatalog, useTitle, useWishlist } from "../lib/hooks";

export function Wishlist() {
  useTitle("Wishlist");
  const { products } = useCatalog();
  const { ids } = useWishlist();
  const saved = ids.map((id) => products.find((p) => p._id === id)).filter(Boolean);

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Wishlist" }]} />
      <h1 className="text-2xl sm:text-3xl font-bold pb-6">
        Wishlist <span className="text-slate font-medium num">({saved.length})</span>
      </h1>
      {saved.length === 0 ? (
        <Empty
          icon={<FiHeart size={24} />}
          title="Nothing saved yet"
          text="Tap the heart on any product to keep it here for later."
          action={<Link to="/products" className="btn btn-primary btn-lg">Browse products</Link>}
        />
      ) : (
        <ProductGrid products={saved} />
      )}
    </div>
  );
}

export function FAQ() {
  useTitle("Help & FAQ");
  const [open, setOpen] = useState(0);
  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Help & FAQ" }]} />
      <div className="max-w-3xl pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Help & FAQ</h1>
        <p className="text-slate mt-1.5">Quick answers about orders, shipping, returns and selling.</p>
      </div>
      <div className="max-w-3xl divide-y divide-line border-y border-line">
        {FAQ_ITEMS.map((f, i) => (
          <div key={f.q}>
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              aria-expanded={open === i}
              className="w-full flex items-center justify-between gap-4 py-5 text-left"
            >
              <span className="font-semibold text-[16px]">{f.q}</span>
              <FiChevronDown className={`shrink-0 transition ${open === i ? "rotate-180" : ""}`} />
            </button>
            {open === i && <p className="pb-5 -mt-1 text-slate leading-relaxed anim-fade">{f.a}</p>}
          </div>
        ))}
      </div>
      <p className="mt-8 text-slate">
        Still stuck? Open the order from <Link to="/profile?tab=orders" className="text-link hover:underline">your orders</Link> and message the shop directly.
      </p>
    </div>
  );
}

export function NotFound() {
  useTitle("Page not found");
  return (
    <div className="container-x py-24 text-center">
      <p className="text-7xl font-bold text-accent num">404</p>
      <h1 className="text-2xl font-bold mt-4">We can't find that page</h1>
      <p className="text-slate mt-2">The link may be broken, or the page may have moved.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/" className="btn btn-primary btn-lg">Back to home</Link>
        <Link to="/products" className="btn btn-outline btn-lg">Browse products</Link>
      </div>
    </div>
  );
}
