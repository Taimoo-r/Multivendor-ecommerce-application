import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { authReducer, sellerReducer, setSeller, setUser } from "./auth";
import { cartReducer, wishlistReducer } from "./cart";
import { vzApi } from "./api";
import { setSessionExpiredHandler } from "../lib/api";

const store = configureStore({
  reducer: {
    auth: authReducer,
    seller: sellerReducer,
    cart: cartReducer,
    wishlist: wishlistReducer,
    [vzApi.reducerPath]: vzApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(vzApi.middleware),
});

setupListeners(store.dispatch); // refetch on reconnect

// The refresh token is gone or was revoked: show the signed-out state.
setSessionExpiredHandler((scope) => {
  const signedIn = scope === "shop" ? store.getState().seller.seller : store.getState().auth.user;
  if (!signedIn) return;
  store.dispatch(scope === "shop" ? setSeller(null) : setUser(null));
  store.dispatch(vzApi.util.invalidateTags(scope === "shop" ? ["SellerProducts", "Orders", "Coupons", "Stats"] : ["Orders"]));
});

export default store;
