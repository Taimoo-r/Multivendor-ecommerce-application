import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { Link, Navigate, useLocation } from "react-router-dom";
import { FiCheck } from "react-icons/fi";
import { Img } from "../components/ui/primitives";
import { money, moneyExact } from "../lib/format";
import { useTitle } from "../lib/hooks";
import { clearCart } from "../store/cart";
import { vzApi } from "../store/api";

export default function OrderSuccess() {
  useTitle("Order confirmed");
  const { state } = useLocation();
  const dispatch = useDispatch();
  const placed = !!state?.orders;

  // the order is in: empty the cart and refresh stock levels
  useEffect(() => {
    if (!placed) return;
    dispatch(clearCart());
    // stock and sold counts changed: drop cached catalogue data
    dispatch(vzApi.util.invalidateTags(["Catalog", "Item", "Events", "Orders"]));
  }, [placed, dispatch]);

  if (!placed) return <Navigate to="/profile?tab=orders" replace />;
  const { orders, summary } = state;

  return (
    <div className="container-x py-10 sm:py-14">
      <div className="max-w-2xl mx-auto">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-ok-soft text-ok grid place-items-center"><FiCheck size={30} /></div>
          <h1 className="text-3xl font-bold mt-5">Thank you, your order is in!</h1>
          <p className="text-slate mt-2">
            {orders.length > 1
              ? `We've split it into ${orders.length} orders, one per shop. Each ships separately.`
              : "The shop will start packing it right away."}
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {orders.map((o) => (
            <section key={o._id} className="card">
              <header className="flex items-center justify-between px-5 py-3.5 border-b border-line text-sm">
                <span className="font-bold num">{o.orderRef}</span>
                <span className="text-slate">{o.shop?.name}</span>
              </header>
              <ul className="px-5 divide-y divide-line">
                {o.cart.map((l) => (
                  <li key={l.productId} className="flex items-center gap-3 py-3">
                    <Img sizes="48px" name={l.image} alt="" className="w-12 h-12 rounded-lg object-cover bg-surface" />
                    <span className="flex-1 min-w-0 text-sm font-medium line-clamp-1">{l.name}</span>
                    <span className="text-sm text-slate num">×{l.qty}</span>
                    <span className="text-sm font-semibold num w-20 text-right">{money(l.price * l.qty)}</span>
                  </li>
                ))}
              </ul>
              <footer className="px-5 py-3.5 border-t border-line flex items-center justify-between text-sm">
                <span className="text-slate">{o.paymentInfo?.type} · {o.paymentInfo?.status}</span>
                <span className="font-bold num">{moneyExact(o.totalPrice)}</span>
              </footer>
            </section>
          ))}
        </div>

        {summary && (
          <p className="text-center text-sm text-slate mt-5">
            Order total <b className="text-ink num">{moneyExact(summary.total)}</b>
            {summary.discount > 0 && <> · you saved <b className="text-ok num">{moneyExact(summary.discount)}</b></>}
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/profile?tab=orders" className="btn btn-primary btn-lg">Track my orders</Link>
          <Link to="/products" className="btn btn-outline btn-lg">Keep shopping</Link>
        </div>
      </div>
    </div>
  );
}
