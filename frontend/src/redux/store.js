import { configureStore } from "@reduxjs/toolkit";
import { userReducer } from "./reducers/userReducer";
import { sellerReducer } from "./reducers/seller";
import { wishlistReducer } from "./reducers/wishlist";
import { productReducer } from "./reducers/product";
import { eventReducer } from "./reducers/event";
import { cartReducer } from "./reducers/cart";
import { orderReducer } from "./reducers/order";

const store = configureStore({
  reducer: {
    user: userReducer,
    seller: sellerReducer,
    products: productReducer,
    events: eventReducer,
    cart: cartReducer,
    wishlist: wishlistReducer,
    order: orderReducer,
  },
});

export default store;