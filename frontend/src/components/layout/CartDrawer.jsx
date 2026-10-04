import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { FiShoppingBag, FiTrash2 } from "react-icons/fi";
import { Drawer, Empty, Img, Price, QtyStepper } from "../ui/primitives";
import { money } from "../../lib/format";
import { useCart } from "../../lib/hooks";
import { openCart, removeItem, setQty } from "../../store/cart";
import { FREE_SHIPPING_OVER } from "../../lib/constants";

// A single cart row, shared by the drawer and the cart page
export const CartLine = ({ line, compact = false }) => {
  const dispatch = useDispatch();
  const img = compact ? "w-16 h-16" : "w-24 h-24 sm:w-28 sm:h-28";
  return (
    <div className="flex gap-4 py-4">
      <Link to={`/product/${line._id}`} className={`${img} rounded-lg bg-surface overflow-hidden shrink-0`}>
        <Img name={line.image} alt={line.name} className="w-full h-full object-cover" />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/product/${line._id}`} className="text-sm font-semibold leading-snug line-clamp-2 hover:underline">
              {line.name}
            </Link>
            {line.shopName && <p className="text-xs text-muted mt-0.5">{line.shopName}</p>}
          </div>
          <button
            onClick={() => dispatch(removeItem(line._id))}
            className="p-1.5 -mr-1.5 h-fit rounded-lg text-muted hover:text-accent hover:bg-surface"
            aria-label={`Remove ${line.name}`}
          >
            <FiTrash2 size={16} />
          </button>
        </div>
        {line.unavailable ? (
          <p className="text-sm text-accent font-medium mt-2">No longer available</p>
        ) : (
          <div className="flex items-center justify-between gap-3 mt-2.5">
            <QtyStepper small value={line.qty} max={line.stock} onChange={(qty) => dispatch(setQty({ id: line._id, qty }))} />
            <div className="text-right">
              <Price price={line.price * line.qty} size="sm" />
              {line.qty > 1 && <p className="text-xs text-muted num">{money(line.price)} each</p>}
            </div>
          </div>
        )}
        {!line.unavailable && line.stock <= 5 && (
          <p className="text-xs text-warn font-medium mt-1.5">Only {line.stock} left</p>
        )}
      </div>
    </div>
  );
};

export default function CartDrawer() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const open = useSelector((s) => s.cart.open);
  const cart = useCart();
  const close = () => dispatch(openCart(false));

  const footer =
    cart.lines.length > 0 ? (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-slate">Subtotal</span>
          <span className="text-lg font-bold num">{money(cart.subTotal)}</span>
        </div>
        <p className="text-xs text-muted">
          Shipping is free on each shop's items over {money(FREE_SHIPPING_OVER)}. Taxes and any coupon are applied at checkout.
        </p>
        <button
          className="btn btn-accent btn-lg btn-block"
          disabled={cart.active.length === 0}
          onClick={() => {
            close();
            navigate("/checkout");
          }}
        >
          Checkout
        </button>
        <Link to="/cart" onClick={close} className="btn btn-outline btn-block">
          View cart
        </Link>
      </div>
    ) : null;

  return (
    <Drawer open={open} onClose={close} title={`Your cart${cart.count ? ` (${cart.count})` : ""}`} footer={footer}>
      {cart.lines.length === 0 ? (
        <Empty
          icon={<FiShoppingBag size={24} />}
          title="Your cart is empty"
          text="Browse the marketplace and add something you like."
          action={
            <Link to="/products" onClick={close} className="btn btn-primary">
              Start shopping
            </Link>
          }
        />
      ) : (
        <div className="px-5 divide-y divide-line">
          {cart.lines.map((l) => (
            <CartLine key={l._id} line={l} compact />
          ))}
        </div>
      )}
    </Drawer>
  );
}
