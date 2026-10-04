import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  FiBarChart2,
  FiBox,
  FiExternalLink,
  FiLogOut,
  FiMenu,
  FiPackage,
  FiPercent,
  FiSettings,
  FiZap,
} from "react-icons/fi";
import { Drawer, Img } from "../../components/ui/primitives";
import { Logo } from "../../components/layout/Header";
import { logoutSeller } from "../../store/auth";
import { Coupons, Orders, Overview, Settings } from "./SellerPages";
import { CreateEvent, CreateProduct, EventsList, ProductsList } from "./SellerCatalog";

const NAV = [
  ["/dashboard", "Overview", FiBarChart2, true],
  ["/dashboard/orders", "Orders", FiPackage],
  ["/dashboard/products", "Products", FiBox],
  ["/dashboard/events", "Live sales", FiZap],
  ["/dashboard/coupons", "Coupons", FiPercent],
  ["/dashboard/settings", "Settings", FiSettings],
];

const Nav = ({ onNavigate }) => (
  <nav className="p-3 space-y-1" aria-label="Seller">
    {NAV.map(([to, label, Icon, end]) => (
      <NavLink
        key={to}
        to={to}
        end={end}
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3.5 h-11 rounded-lg text-sm font-semibold ${isActive ? "bg-ink text-white" : "text-ink-2 hover:bg-surface"}`
        }
      >
        <Icon size={17} /> {label}
      </NavLink>
    ))}
  </nav>
);

export default function SellerArea() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loc = useLocation();
  const { seller } = useSelector((s) => s.seller);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    document.title = "Seller dashboard | VendorZone";
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  const logout = async () => {
    await dispatch(logoutSeller());
    toast.success("Signed out");
    navigate("/shop-login");
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 bg-white border-b border-line">
        <div className="h-16 px-4 lg:px-6 flex items-center gap-3">
          <button onClick={() => setMenu(true)} className="lg:hidden w-10 h-10 -ml-2 grid place-items-center rounded-lg hover:bg-surface" aria-label="Open menu">
            <FiMenu size={22} />
          </button>
          <Logo />
          <span className="hidden sm:inline-flex badge bg-surface-2 text-ink-2 ml-1">Seller</span>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <Link to={`/shop/${seller._id}`} className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-link hover:underline">
              View my shop <FiExternalLink size={14} />
            </Link>
            <div className="flex items-center gap-2.5">
              <Img name={seller.avatar} alt="" className="w-9 h-9 rounded-lg object-cover bg-surface" />
              <span className="hidden md:block text-sm font-semibold max-w-[160px] truncate">{seller.name}</span>
            </div>
            <button onClick={logout} className="btn btn-ghost btn-sm" aria-label="Sign out"><FiLogOut size={16} /> <span className="hidden sm:inline">Sign out</span></button>
          </div>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block bg-white border-r border-line min-h-[calc(100vh-64px)] sticky top-16 self-start">
          <Nav />
        </aside>
        <main className="p-4 sm:p-6 lg:p-8 min-w-0 max-w-[1200px] w-full">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="orders" element={<Orders />} />
            <Route path="products" element={<ProductsList />} />
            <Route path="products/new" element={<CreateProduct />} />
            <Route path="events" element={<EventsList />} />
            <Route path="events/new" element={<CreateEvent />} />
            <Route path="coupons" element={<Coupons />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Overview />} />
          </Routes>
        </main>
      </div>

      <Drawer open={menu} onClose={() => setMenu(false)} title="Seller menu" side="left">
        <Nav onNavigate={() => setMenu(false)} />
      </Drawer>
    </div>
  );
}
