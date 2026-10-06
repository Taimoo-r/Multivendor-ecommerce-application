import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  FiGrid,
  FiHeart,
  FiLogOut,
  FiMenu,
  FiPackage,
  FiSearch,
  FiShoppingBag,
  FiUser,
  FiChevronDown,
  FiBriefcase,
} from "react-icons/fi";
import { Drawer, Img } from "../ui/primitives";
import { CATEGORIES, CATEGORY_SHORT } from "../../lib/constants";
import { money } from "../../lib/format";
import { useCart, useDebounced } from "../../lib/hooks";
import { useGetEventsQuery, useLazySearchProductsQuery } from "../../store/api";
import { openCart } from "../../store/cart";
import { logoutUser } from "../../store/auth";

export const Logo = ({ light = false, className = "" }) => (
  <Link to="/" className={`inline-flex items-center gap-2 ${className}`} aria-label="VendorZone home">
    <span className="w-8 h-8 rounded-lg bg-ink grid place-items-center relative">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 6h5l4 11 4-11h5l-7 15h-4z" fill="#fff" />
      </svg>
      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent border-2 border-white" />
    </span>
    <span className={`text-[21px] font-bold tracking-tight ${light ? "text-white" : "text-ink"}`}>
      vendorzone
    </span>
  </Link>
);

const SearchBox = ({ autoFocus = false, onDone }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  // Server-side suggestions. Debounced, so typing "headphones" sends one or two requests
  // instead of ten, and each new term aborts the request for the previous one, so a slow
  // older response can never overwrite a newer one.
  const dq = useDebounced(q.trim(), 250);
  const [search, { data, isFetching }] = useLazySearchProductsQuery();
  useEffect(() => {
    if (dq.length < 2) return;
    const req = search({ q: dq, limit: 6 }, true); // true: reuse a cached result for this term
    return () => req.abort();
  }, [dq, search]);
  const matches = dq.length >= 2 ? data?.products || [] : [];

  useEffect(() => {
    const away = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const submit = (e) => {
    e?.preventDefault();
    setOpen(false);
    navigate(`/products?q=${encodeURIComponent(q.trim())}`);
    onDone?.();
  };

  return (
    <div ref={box} className="relative w-full">
      <form onSubmit={submit} role="search" className="flex items-center h-11 rounded-xl bg-surface border border-transparent focus-within:bg-white focus-within:border-ink transition">
        <FiSearch className="ml-3.5 text-muted shrink-0" size={18} />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoFocus={autoFocus}
          placeholder="Search products, brands and shops"
          aria-label="Search"
          className="flex-1 min-w-0 h-full bg-transparent px-3 text-sm outline-none"
        />
        <button type="submit" className="h-9 mr-1 px-4 rounded-lg bg-ink text-white text-sm font-semibold hover:bg-ink-2">
          Search
        </button>
      </form>

      {open && q.trim().length >= 2 && (
        <div className="absolute z-50 left-0 right-0 top-[calc(100%+6px)] bg-white border border-line rounded-xl shadow-[0_12px_32px_-12px_rgba(10,26,28,.25)] overflow-hidden anim-pop">
          {matches.length === 0 ? (
            <p className="px-4 py-5 text-sm text-slate">
              {isFetching || dq !== q.trim() ? "Searching…" : `No matches for "${q.trim()}"`}
            </p>
          ) : (
            <>
              <ul>
                {matches.map((p) => (
                  <li key={p._id}>
                    <Link
                      to={`/product/${p._id}`}
                      onClick={() => {
                        setOpen(false);
                        onDone?.();
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface"
                    >
                      <Img name={p.images?.[0]} alt="" sizes="44px" className="w-11 h-11 rounded-lg object-cover bg-surface shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">{p.name}</span>
                        <span className="block text-xs text-muted truncate">{p.category}</span>
                      </span>
                      <span className="text-sm font-bold num">{money(p.discountPrice)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button onClick={submit} className="w-full text-left px-4 py-3 text-sm font-semibold text-link border-t border-line hover:bg-surface">
                See all results for "{q.trim()}"
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const AccountMenu = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, status } = useSelector((s) => s.auth);
  const { seller } = useSelector((s) => s.seller);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const loc = useLocation();

  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const away = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const logout = async () => {
    await dispatch(logoutUser());
    toast.success("Signed out");
    navigate("/");
  };

  if (status !== "authed") {
    return (
      <Link to="/login" className="flex items-center gap-2 w-10 h-10 sm:w-auto sm:h-auto justify-center sm:px-2 sm:py-1.5 rounded-lg hover:bg-surface text-sm" aria-label="Sign in">
        <FiUser size={20} />
        <span className="hidden sm:block leading-tight text-left">
          <span className="block text-[11px] text-muted">Welcome</span>
          <span className="block font-semibold">Sign in</span>
        </span>
      </Link>
    );
  }

  const item = "flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-surface w-full text-left";
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-surface"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Img name={user.avatar} alt="" sizes="32px" className="w-8 h-8 rounded-full object-cover bg-surface" />
        <span className="hidden md:block text-left leading-tight">
          <span className="block text-[11px] text-muted">Hello</span>
          <span className="block text-sm font-semibold max-w-[96px] truncate">{user.name.split(" ")[0]}</span>
        </span>
        <FiChevronDown size={14} className="hidden md:block text-muted" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] w-56 bg-white border border-line rounded-xl shadow-[0_12px_32px_-12px_rgba(10,26,28,.25)] p-1.5 z-50 anim-pop">
          <div className="px-3 py-2 border-b border-line mb-1.5">
            <p className="text-sm font-semibold truncate">{user.name}</p>
            <p className="text-xs text-muted truncate">{user.email}</p>
          </div>
          <Link to="/profile" className={item} role="menuitem"><FiUser size={16} /> My account</Link>
          <Link to="/profile?tab=orders" className={item} role="menuitem"><FiPackage size={16} /> My orders</Link>
          <Link to="/wishlist" className={item} role="menuitem"><FiHeart size={16} /> Wishlist</Link>
          {seller && <Link to="/dashboard" className={item} role="menuitem"><FiBriefcase size={16} /> Seller dashboard</Link>}
          <button onClick={logout} className={`${item} text-accent`} role="menuitem"><FiLogOut size={16} /> Sign out</button>
        </div>
      )}
    </div>
  );
};

const IconLink = ({ to, onClick, label, count, children }) => {
  const cls = "relative w-10 h-10 grid place-items-center rounded-lg hover:bg-surface";
  const badge = count > 0 && (
    <span className="absolute top-0.5 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold grid place-items-center num">
      {count > 99 ? "99+" : count}
    </span>
  );
  return to ? (
    <Link to={to} className={cls} aria-label={label}>{children}{badge}</Link>
  ) : (
    <button onClick={onClick} className={cls} aria-label={label}>{children}{badge}</button>
  );
};

export default function Header() {
  const dispatch = useDispatch();
  const cart = useCart();
  const wishCount = useSelector((s) => s.wishlist.ids.length);
  const { seller } = useSelector((s) => s.seller);
  const { data: events = [] } = useGetEventsQuery();
  const [menu, setMenu] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [mega, setMega] = useState(false);
  const loc = useLocation();
  const megaRef = useRef(null);
  const liveSales = events.filter((e) => e.status === "Running").length;

  useEffect(() => {
    setMenu(false);
    setMega(false);
    setMobileSearch(false);
  }, [loc.pathname, loc.search]);

  useEffect(() => {
    const away = (e) => megaRef.current && !megaRef.current.contains(e.target) && setMega(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const navLink = ({ isActive }) =>
    `h-full inline-flex items-center px-3 text-[13px] font-medium whitespace-nowrap border-b-2 ${
      isActive ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink"
    }`;

  return (
    <header className="sticky top-0 z-40 bg-white">
      {/* utility bar */}
      <div className="bg-ink text-white text-xs hidden sm:block">
        <div className="container-x h-9 flex items-center justify-between">
          <p className="opacity-90">Free shipping on each shop's items over $50 · 30-day returns</p>
          <div className="flex items-center gap-5 opacity-90">
            {seller ? (
              <Link to="/dashboard" className="hover:underline">Seller dashboard</Link>
            ) : (
              <Link to="/shop-create" className="hover:underline">Sell on VendorZone</Link>
            )}
            <Link to="/faq" className="hover:underline">Help</Link>
          </div>
        </div>
      </div>

      {/* main bar */}
      <div className="border-b border-line">
        <div className="container-x h-16 lg:h-[72px] flex items-center gap-3 lg:gap-8">
          <button onClick={() => setMenu(true)} className="lg:hidden w-10 h-10 -ml-2 grid place-items-center rounded-lg hover:bg-surface" aria-label="Open menu">
            <FiMenu size={22} />
          </button>
          <Logo />
          <div className="hidden lg:block flex-1 max-w-2xl">
            <SearchBox />
          </div>
          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <button onClick={() => setMobileSearch((s) => !s)} className="lg:hidden w-10 h-10 grid place-items-center rounded-lg hover:bg-surface" aria-label="Search">
              <FiSearch size={20} />
            </button>
            <AccountMenu />
            <IconLink to="/wishlist" label="Wishlist" count={wishCount}><FiHeart size={21} /></IconLink>
            <button
              onClick={() => dispatch(openCart(true))}
              className="flex items-center gap-3 h-10 pl-2.5 pr-3 sm:pr-3.5 rounded-lg hover:bg-surface"
              aria-label={`Cart, ${cart.count} items`}
            >
              <span className="relative">
                <FiShoppingBag size={21} />
                {cart.count > 0 && (
                  <span className="absolute -top-2 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold grid place-items-center num">
                    {cart.count}
                  </span>
                )}
              </span>
              <span className="hidden sm:block text-sm font-semibold num">{cart.count > 0 ? money(cart.subTotal) : "Cart"}</span>
            </button>
          </div>
        </div>
        {mobileSearch && (
          <div className="lg:hidden container-x pb-3">
            <SearchBox autoFocus onDone={() => setMobileSearch(false)} />
          </div>
        )}
      </div>

      {/* category nav */}
      <nav className="hidden lg:block border-b border-line bg-white" aria-label="Categories">
        <div className="container-x h-11 flex items-center gap-1">
          <div ref={megaRef} className="relative h-full">
            <button
              onClick={() => setMega((m) => !m)}
              className="h-full inline-flex items-center gap-2 pr-4 mr-2 text-[13px] font-bold"
              aria-expanded={mega}
            >
              <FiGrid size={16} /> All categories <FiChevronDown size={14} className={`transition ${mega ? "rotate-180" : ""}`} />
            </button>
            {mega && (
              <div className="absolute left-0 top-full w-[560px] bg-white border border-line rounded-xl shadow-[0_16px_40px_-16px_rgba(10,26,28,.3)] p-3 grid grid-cols-2 gap-1 anim-pop">
                {CATEGORIES.map((c) => (
                  <Link key={c} to={`/products?category=${encodeURIComponent(c)}`} className="px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-surface">
                    {c}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 h-full flex items-center overflow-x-auto no-scrollbar">
            {CATEGORIES.map((c) => (
              <Link key={c} to={`/products?category=${encodeURIComponent(c)}`} className="h-full inline-flex items-center px-3 text-[13px] font-medium whitespace-nowrap text-ink-2 hover:text-ink border-b-2 border-transparent hover:border-line">
                {CATEGORY_SHORT[c] || c}
              </Link>
            ))}
          </div>
          <div className="h-full flex items-center shrink-0 border-l border-line pl-2 ml-2">
            <NavLink to="/best-selling" className={navLink}>Best sellers</NavLink>
            <NavLink to="/events" className={navLink}>
              <span className="inline-flex items-center gap-1.5">
                {liveSales > 0 && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
                Live sales
              </span>
            </NavLink>
            <NavLink to="/shops" className={navLink}>Brand stores</NavLink>
          </div>
        </div>
      </nav>

      <Drawer open={menu} onClose={() => setMenu(false)} title="Menu" side="left">
        <div className="p-3">
          <p className="px-3 pt-2 pb-1 text-xs font-bold uppercase tracking-wider text-muted">Shop</p>
          {[
            ["/best-selling", "Best sellers"],
            ["/events", "Live sales"],
            ["/shops", "Brand stores"],
            ["/products", "All products"],
          ].map(([to, label]) => (
            <Link key={to} to={to} className="block px-3 py-2.5 rounded-lg text-[15px] font-medium hover:bg-surface">{label}</Link>
          ))}
          <p className="px-3 pt-5 pb-1 text-xs font-bold uppercase tracking-wider text-muted">Categories</p>
          {CATEGORIES.map((c) => (
            <Link key={c} to={`/products?category=${encodeURIComponent(c)}`} className="block px-3 py-2.5 rounded-lg text-[15px] hover:bg-surface">{c}</Link>
          ))}
          <p className="px-3 pt-5 pb-1 text-xs font-bold uppercase tracking-wider text-muted">More</p>
          <Link to="/login" className="block px-3 py-2.5 rounded-lg text-[15px] hover:bg-surface">Sign in</Link>
          <Link to={seller ? "/dashboard" : "/shop-create"} className="block px-3 py-2.5 rounded-lg text-[15px] hover:bg-surface">
            {seller ? "Seller dashboard" : "Sell on VendorZone"}
          </Link>
          <Link to="/faq" className="block px-3 py-2.5 rounded-lg text-[15px] hover:bg-surface">Help & FAQ</Link>
        </div>
      </Drawer>
    </header>
  );
}
