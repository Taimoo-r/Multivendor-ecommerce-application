import { configureStore } from "@reduxjs/toolkit";
import { authReducer, sellerReducer } from "./auth";
import { catalogReducer } from "./catalog";
import { cartReducer, wishlistReducer } from "./cart";

export default configureStore({
  reducer: {
    auth: authReducer,
    seller: sellerReducer,
    catalog: catalogReducer,
    cart: cartReducer,
    wishlist: wishlistReducer,
  },
});
