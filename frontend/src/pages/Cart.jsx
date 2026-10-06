import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { FiShoppingBag } from "react-icons/fi";
import { Breadcrumbs, Empty } from "../components/ui/primitives";
import { CartLine } from "../components/layout/CartDrawer";
import { FREE_SHIPPING_OVER } from "../lib/constants";
import { money } from "../lib/format";
import { useCart, useTitle } from "../lib/hooks";
import { clearCart } from "../store/cart";

export default function Cart() {
  useTitle("Your cart");
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const cart = useCart();

  if (cart.lines.length === 0) {
    return (
      <div className="container-x">
        <Empty
          icon={<FiShoppingBag size={24} />}
          title="Your cart is empty"
          text="Browse the marketplace and add something you like."
          action={<Link to="/products" className="btn btn-primary btn-lg">Start shopping</Link>}
        />
      </div>
    );
  }

  // group by shop; each shop ships separately and has its own free-shipping threshold
  const groups = [];
  cart.lines.forEach((l) => {
    let g = groups.find((x) => x.shopId === l.shopId);
    if (!g) groups.push((g = { shopId: l.shopId, shopName: l.shopName || "Shop", lines: [] }));
    g.lines.push(l);
  });

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Cart" }]} />
      <div className="flex items-end justify-between pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Your cart <span className="text-slate font-medium num">({cart.count})</span></h1>
        <button onClick={() => dispatch(clearCart())} className="text-sm text-slate hover:text-accent hover:underline">Clear cart</button>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
        <div className="space-y-4">
          {groups.map((g) => {
            const subtotal = g.lines.filter((l) => !l.unavailable).reduce((a, l) => a + l.price * l.qty, 0);
            const remaining = FREE_SHIPPING_OVER - subtotal;
            return (
              <section key={g.shopId} className="card">
                <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line">
                  <Link to={`/shop/${g.shopId}`} className="font-bold hover:underline">{g.shopName}</Link>
                  {subtotal > 0 && (
                    <span className={`text-xs font-medium ${remaining <= 0 ? "text-ok" : "text-slate"}`}>
                      {remaining <= 0 ? "Free shipping" : `Add ${money(remaining)} for free shipping`}
                    </span>
                  )}
                </header>
                <div className="px-5 divide-y divide-line">
                  {g.lines.map((l) => <CartLine key={l._id} line={l} />)}
                </div>
              </section>
            );
          })}
        </div>

        <aside className="card p-6 lg:sticky lg:top-40">
          <h2 className="text-lg font-bold">Order summary</h2>
          <dl className="mt-4 space-y-3 text-[15px]">
            <div className="flex justify-between"><dt className="text-slate">Subtotal</dt><dd className="font-semibold num">{money(cart.subTotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate">Shipping (est.)</dt><dd className="font-semibold num">{cart.shipping === 0 ? "Free" : money(cart.shipping)}</dd></div>
            <div className="flex justify-between pt-3 border-t border-line text-lg"><dt className="font-bold">Total</dt><dd className="font-bold num">{money(cart.total)}</dd></div>
          </dl>
          <p className="hint">Coupon codes are applied at checkout.</p>
          <button
            onClick={() => navigate("/checkout")}
            disabled={cart.active.length === 0}
            className="btn btn-accent btn-lg btn-block mt-5"
          >
            Checkout
          </button>
          <Link to="/products" className="btn btn-ghost btn-block mt-2">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
