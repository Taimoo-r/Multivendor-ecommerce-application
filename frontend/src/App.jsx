import { Suspense, lazy, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { useDispatch } from "react-redux";
import Layout from "./components/layout/Layout";
import { RequireSeller, RequireUser } from "./components/layout/guards";
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetails from "./pages/ProductDetails";
import Events from "./pages/Events";
import { Shops, ShopPage } from "./pages/Shops";
import Cart from "./pages/Cart";
import { FAQ, NotFound, Wishlist } from "./pages/Misc";
import {
  Activation,
  ForgotPassword,
  Login,
  ResetPassword,
  ShopCreate,
  ShopLogin,
  Signup,
} from "./pages/auth/Auth";
import { PageLoader } from "./components/ui/primitives";
import { loadSeller, loadUser } from "./store/auth";

// heavy, signed-in-only areas load on demand
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess"));
const Profile = lazy(() => import("./pages/account/Profile"));
const SellerArea = lazy(() => import("./pages/seller/SellerArea"));

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(loadUser());
    dispatch(loadSeller());
  }, [dispatch]);

  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="products" element={<Products />} />
        <Route
          path="best-selling"
          element={<Products preset={{ title: "Best sellers", subtitle: "What everyone is buying right now", sort: "best" }} />}
        />
        <Route path="product/:id" element={<ProductDetails />} />
        <Route path="events" element={<Events />} />
        <Route path="shops" element={<Shops />} />
        <Route path="shop/:id" element={<ShopPage />} />
        <Route path="cart" element={<Cart />} />
        <Route path="wishlist" element={<Wishlist />} />
        <Route path="faq" element={<FAQ />} />

        <Route path="checkout" element={<RequireUser><Checkout /></RequireUser>} />
        <Route path="order/success" element={<RequireUser><OrderSuccess /></RequireUser>} />
        <Route path="profile" element={<RequireUser><Profile /></RequireUser>} />

        <Route path="login" element={<Login />} />
        <Route path="sign-up" element={<Signup />} />
        <Route path="activation/:activation_token" element={<Activation />} />
        <Route path="forgot-password" element={<ForgotPassword type="user" />} />
        <Route path="reset-password/:token" element={<ResetPassword type="user" />} />

        <Route path="shop-login" element={<ShopLogin />} />
        <Route path="shop-create" element={<ShopCreate />} />
        <Route path="seller/activation/:activation_token" element={<Activation seller />} />
        <Route path="shop-forgot-password" element={<ForgotPassword type="shop" />} />
        <Route path="shop-reset-password/:token" element={<ResetPassword type="shop" />} />

        <Route path="*" element={<NotFound />} />
      </Route>

      {/* seller dashboard has its own chrome */}
      <Route path="dashboard/*" element={<RequireSeller><SellerArea /></RequireSeller>} />
    </Routes>
    </Suspense>
  );
}
