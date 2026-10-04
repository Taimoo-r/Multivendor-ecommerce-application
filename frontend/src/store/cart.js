import { createSlice } from "@reduxjs/toolkit";

const KEY = "vz_cart";
const WISH = "vz_wishlist";

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage can be unavailable (private mode) */
  }
};

// A cart item keeps enough to render before the catalogue loads. Live price and stock are
// read from the catalogue, and the server re-prices everything at checkout anyway.
const cartSlice = createSlice({
  name: "cart",
  initialState: { items: read(KEY, []), open: false },
  reducers: {
    addItem(state, { payload }) {
      const { item, qty = 1 } = payload;
      const found = state.items.find((i) => i._id === item._id);
      const max = item.stock ?? 99;
      if (found) found.qty = Math.min(found.qty + qty, max);
      else state.items.push({ ...item, qty: Math.min(qty, max) });
      write(KEY, state.items);
    },
    setQty(state, { payload }) {
      const found = state.items.find((i) => i._id === payload.id);
      if (found) {
        found.qty = Math.max(1, Math.min(payload.qty, found.stock ?? 99));
      }
      write(KEY, state.items);
    },
    removeItem(state, { payload }) {
      state.items = state.items.filter((i) => i._id !== payload);
      write(KEY, state.items);
    },
    clearCart(state) {
      state.items = [];
      write(KEY, state.items);
    },
    openCart(state, { payload }) {
      state.open = payload;
    },
  },
});

const wishSlice = createSlice({
  name: "wishlist",
  initialState: { ids: read(WISH, []) },
  reducers: {
    toggleWish(state, { payload }) {
      state.ids = state.ids.includes(payload)
        ? state.ids.filter((i) => i !== payload)
        : [payload, ...state.ids];
      write(WISH, state.ids);
    },
  },
});

export const { addItem, setQty, removeItem, clearCart, openCart } =
  cartSlice.actions;
export const { toggleWish } = wishSlice.actions;
export const cartReducer = cartSlice.reducer;
export const wishlistReducer = wishSlice.reducer;

// the snapshot stored in the cart for a product or an event
export const toCartItem = (p, kind = "Product") => ({
  _id: p._id,
  kind,
  name: p.name,
  image: p.images?.[0],
  price: p.discountPrice,
  originalPrice: p.originalPrice,
  stock: p.stock,
  shopId: p.shopId,
  shopName: p.shop?.name,
});
