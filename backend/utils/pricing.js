const Product = require("../model/product");
const Event = require("../model/event");
const CouponCode = require("../model/couponCode");
const ErrorHandler = require("./ErrorHandler");

const FREE_SHIPPING_OVER = 50; // per shop order
const SHIPPING_FLAT = 4.99;

const round = (n) => Math.round(n * 100) / 100;

// Prices, stock and coupons always come from the database, never from the client.
// `items` is [{ _id, qty }]. Returns one priced order per shop plus grand totals.
async function priceCart(items, couponName) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ErrorHandler("Your cart is empty", 400);
  }

  const wanted = new Map();
  for (const item of items) {
    const qty = Math.max(1, parseInt(item.qty, 10) || 1);
    wanted.set(String(item._id), (wanted.get(String(item._id)) || 0) + qty);
  }

  // A cart line is either a regular product or a running event (flash sale).
  const ids = [...wanted.keys()];
  const products = await Product.find({ _id: { $in: ids } });
  const byId = new Map(products.map((p) => [String(p._id), { doc: p, kind: "Product" }]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    const events = await Event.find({ _id: { $in: missing } });
    const now = Date.now();
    for (const e of events) {
      if (now < new Date(e.start_Date).getTime() || now > new Date(e.Finish_Date).getTime()) {
        throw new ErrorHandler(`The sale for ${e.name} isn't running`, 400);
      }
      byId.set(String(e._id), { doc: e, kind: "Event" });
    }
  }

  const lines = [];
  for (const [id, qty] of wanted) {
    const found = byId.get(id);
    if (!found) {
      throw new ErrorHandler("An item in your cart is no longer available", 400);
    }
    const product = found.doc;
    if (product.stock < qty) {
      throw new ErrorHandler(
        product.stock > 0
          ? `Only ${product.stock} left of ${product.name}`
          : `${product.name} is out of stock`,
        400
      );
    }
    lines.push({ product, kind: found.kind, qty, price: product.discountPrice });
  }

  let coupon = null;
  const code = String(couponName || "").trim();
  if (code) {
    coupon = await CouponCode.findOne({ name: code });
    if (!coupon) throw new ErrorHandler("That coupon code doesn't exist", 400);
  }

  const byShop = new Map();
  for (const line of lines) {
    const key = String(line.product.shopId);
    if (!byShop.has(key)) byShop.set(key, []);
    byShop.get(key).push(line);
  }

  const orders = [];
  for (const [shopId, shopLines] of byShop) {
    const subTotal = round(shopLines.reduce((a, l) => a + l.price * l.qty, 0));

    let discount = 0;
    if (coupon && coupon.shopId === shopId) {
      const eligible = shopLines
        .filter(
          (l) =>
            !coupon.selectedProduct ||
            String(l.product._id) === coupon.selectedProduct
        )
        .reduce((a, l) => a + l.price * l.qty, 0);
      if (eligible > 0 && (!coupon.minAmount || eligible >= coupon.minAmount)) {
        discount = (eligible * coupon.value) / 100;
        if (coupon.maxAmount) discount = Math.min(discount, coupon.maxAmount);
      }
    }
    discount = round(discount);

    const shipping = subTotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT;
    orders.push({
      shopId,
      lines: shopLines,
      subTotal,
      discount,
      shipping,
      total: round(subTotal - discount + shipping),
    });
  }

  if (coupon && !orders.some((o) => o.discount > 0)) {
    throw new ErrorHandler(
      "That coupon doesn't apply to the items in your cart",
      400
    );
  }

  const sum = (key) => round(orders.reduce((a, o) => a + o[key], 0));
  return {
    orders,
    couponCode: coupon ? coupon.name : null,
    subTotal: sum("subTotal"),
    discount: sum("discount"),
    shipping: sum("shipping"),
    total: sum("total"),
  };
}

// What the client is allowed to see of a priced cart.
const summary = (priced) => ({
  subTotal: priced.subTotal,
  discount: priced.discount,
  shipping: priced.shipping,
  total: priced.total,
  couponCode: priced.couponCode,
  freeShippingOver: FREE_SHIPPING_OVER,
});

module.exports = { priceCart, summary, FREE_SHIPPING_OVER, SHIPPING_FLAT };
