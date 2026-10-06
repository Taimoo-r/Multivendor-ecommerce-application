import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { addItem, openCart, toCartItem, toggleWish } from "../store/cart";
import { FREE_SHIPPING_OVER, SHIPPING_FLAT } from "./constants";
import { useLookupQuery } from "../store/api";

// Live price and stock for a list of ids (cart, wishlist), from GET /product/lookup.
export const useLiveItems = (ids) => {
  const key = useMemo(() => [...new Set(ids)].sort(), [ids]);
  const { data, isSuccess, isFetching } = useLookupQuery(key, { skip: key.length === 0 });
  const index = useMemo(() => new Map((data || []).map((i) => [i._id, i])), [data]);
  return { index, ready: key.length === 0 || isSuccess, isFetching };
};

// Cart lines with live data merged in, plus totals. Shipping here is an estimate;
// checkout asks the server for the exact figures.
export const useCart = () => {
  const items = useSelector((s) => s.cart.items);
  const ids = useMemo(() => items.map((i) => i._id), [items]);
  const { index, ready } = useLiveItems(ids);

  return useMemo(() => {
    const lines = items.map((i) => {
      const live = index.get(i._id);
      const price = live ? live.discountPrice : i.price;
      const stock = live ? live.stock : i.stock;
      const gone = ready && !live;
      const ended = live?.kind === "Event" && live.status !== "Running";
      return {
        ...i,
        price,
        stock,
        originalPrice: live ? live.originalPrice : i.originalPrice,
        image: live ? live.images?.[0] : i.image,
        name: live ? live.name : i.name,
        qty: Math.min(i.qty, Math.max(stock, 1)),
        unavailable: gone || ended || stock < 1,
      };
    });
    const active = lines.filter((l) => !l.unavailable);
    const byShop = new Map();
    active.forEach((l) =>
      byShop.set(l.shopId, (byShop.get(l.shopId) || 0) + l.price * l.qty)
    );
    const subTotal = [...byShop.values()].reduce((a, b) => a + b, 0);
    const shipping = [...byShop.values()].reduce(
      (a, v) => a + (v >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT),
      0
    );
    return {
      lines,
      active,
      count: active.reduce((a, l) => a + l.qty, 0),
      subTotal,
      shipping,
      total: subTotal + shipping,
    };
  }, [items, index, ready]);
};

export const useAddToCart = () => {
  const dispatch = useDispatch();
  return useCallback(
    (product, qty = 1, kind = "Product", { open = true } = {}) => {
      if (product.stock < 1) {
        toast.error("Sorry, this item is out of stock");
        return false;
      }
      dispatch(addItem({ item: toCartItem(product, kind), qty }));
      toast.success("Added to cart");
      if (open) dispatch(openCart(true));
      return true;
    },
    [dispatch]
  );
};

export const useWishlist = () => {
  const dispatch = useDispatch();
  const ids = useSelector((s) => s.wishlist.ids);
  const toggle = useCallback(
    (product) => {
      const has = ids.includes(product._id);
      dispatch(toggleWish(product._id));
      toast(has ? "Removed from wishlist" : "Saved to wishlist", {
        icon: has ? "✕" : "♥",
      });
    },
    [dispatch, ids]
  );
  return { ids, toggle, has: (id) => ids.includes(id) };
};

// lock page scroll while a drawer/modal is open
export const useLockScroll = (locked) => {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
};

export const useDebounced = (value, ms = 250) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

export const useTitle = (title) => {
  useEffect(() => {
    document.title = title ? `${title} | VendorZone` : "VendorZone | Shop independent brands";
  }, [title]);
};
