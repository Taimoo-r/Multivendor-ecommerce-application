import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { CATEGORIES } from "../../lib/constants";
import { Logo } from "./Header";

const col = "space-y-2.5 text-sm text-slate";
const link = "hover:text-ink hover:underline";

export default function Footer() {
  const [email, setEmail] = useState("");

  const subscribe = (e) => {
    e.preventDefault();
    toast.success("Thanks! You're on the list.");
    setEmail("");
  };

  return (
    <footer className="bg-surface border-t border-line mt-20">
      <div className="container-x py-12 grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="text-sm text-slate mt-4 max-w-xs">
            A marketplace for independent shops. One cart, many brands, honest prices.
          </p>
          <form onSubmit={subscribe} className="mt-5 flex gap-2 max-w-sm">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              aria-label="Email for newsletter"
              className="field"
            />
            <button className="btn btn-primary shrink-0">Join</button>
          </form>
          <p className="hint">Deals and new drops, once a week. Unsubscribe any time.</p>
        </div>

        <div>
          <h4 className="text-sm font-bold mb-3.5">Shop</h4>
          <ul className={col}>
            {CATEGORIES.map((c) => (
              <li key={c}>
                <Link className={link} to={`/products?category=${encodeURIComponent(c)}`}>{c}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold mb-3.5">Marketplace</h4>
          <ul className={col}>
            <li><Link className={link} to="/best-selling">Best sellers</Link></li>
            <li><Link className={link} to="/events">Live sales</Link></li>
            <li><Link className={link} to="/shops">Brand stores</Link></li>
            <li><Link className={link} to="/wishlist">Wishlist</Link></li>
            <li><Link className={link} to="/shop-create">Sell on VendorZone</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold mb-3.5">Support</h4>
          <ul className={col}>
            <li><Link className={link} to="/faq">Help & FAQ</Link></li>
            <li><Link className={link} to="/faq">Shipping & delivery</Link></li>
            <li><Link className={link} to="/faq">Returns</Link></li>
            <li><Link className={link} to="/profile?tab=orders">Track an order</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-x py-5 flex flex-col sm:flex-row gap-2 sm:items-center justify-between text-xs text-muted">
          <p>© {new Date().getFullYear()} VendorZone. All rights reserved.</p>
          <p>Demo marketplace: shops, products and reviews are sample data. Card payments run in Stripe test mode.</p>
        </div>
      </div>
    </footer>
  );
}
