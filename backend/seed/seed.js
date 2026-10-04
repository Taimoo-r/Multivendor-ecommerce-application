// Seeds demo shops, products, events, coupons, buyers, reviews and orders.
//   cd backend && npm run seed            (uses DB_URL from .env)
//   node seed/seed.js --db vendorzone_dev (use a different database name)
// Re-running replaces only the demo data (accounts @demo.vendorzone.tech);
// anything else in the database is left alone.
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const User = require("../model/User");
const Shop = require("../model/shop");
const Product = require("../model/product");
const Event = require("../model/event");
const Order = require("../model/order");
const CouponCode = require("../model/couponCode");
const { publicShop } = require("../utils/publicShop");
const data = require("./data");
require("../db/Database").useCustomDns();

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const ago = (days) => new Date(NOW - days * DAY);

// small deterministic RNG so every run builds the same catalogue and history
let seedState = 20261004;
const rand = () => {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[int(0, arr.length - 1)];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const round2 = (n) => Math.round(n * 100) / 100;

const IMAGES = path.join(__dirname, "images");
const UPLOADS = path.join(__dirname, "..", "uploads");

function copyImages() {
  fs.mkdirSync(UPLOADS, { recursive: true });
  let n = 0;
  for (const dir of [IMAGES, path.join(IMAGES, "avatars")]) {
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(jpe?g|png)$/i.test(f)) continue;
      fs.copyFileSync(path.join(dir, f), path.join(UPLOADS, f));
      n++;
    }
  }
  return n;
}

const imagesFor = (slug) =>
  [`${slug}-1.jpg`, `${slug}-2.jpg`].filter((f) => fs.existsSync(path.join(IMAGES, f)));

async function wipeDemoData() {
  const re = new RegExp(`@${data.DOMAIN.replace(/\./g, "\\.")}$`);
  const shops = await Shop.find({ email: re }, "_id");
  const users = await User.find({ email: re }, "_id");
  const shopIds = shops.map((s) => String(s._id));
  const userIds = users.map((u) => u._id);
  await Promise.all([
    Product.deleteMany({ shopId: { $in: shopIds } }),
    Event.deleteMany({ shopId: { $in: shopIds } }),
    CouponCode.deleteMany({ shopId: { $in: shopIds } }),
    Order.deleteMany({ $or: [{ shopId: { $in: shopIds } }, { "user._id": { $in: userIds } }] }),
  ]);
  await Shop.deleteMany({ _id: { $in: shops.map((s) => s._id) } });
  await User.deleteMany({ _id: { $in: userIds } });
}

async function main() {
  const dbArg = process.argv.indexOf("--db");
  const dbName = dbArg > -1 ? process.argv[dbArg + 1] : undefined;
  if (!process.env.DB_URL) throw new Error("DB_URL is not set (backend/.env)");
  await mongoose.connect(process.env.DB_URL, dbName ? { dbName } : {});
  console.log("Connected to", mongoose.connection.name);

  console.log("Copied", copyImages(), "images to uploads/");
  await wipeDemoData();

  const passwordHash = await bcrypt.hash(data.PASSWORD, 10);

  // ---- shops
  const shopDocs = await Shop.insertMany(
    data.shops.map((s) => ({
      name: s.name,
      email: `${s.slug}@${data.DOMAIN}`,
      password: passwordHash,
      description: s.description,
      address: s.address,
      phoneNumber: s.phoneNumber,
      zipCode: s.zipCode,
      avatar: `shop-${s.slug}.jpg`,
      createdAt: ago(int(150, 330)),
    }))
  );
  const shopBySlug = new Map(data.shops.map((s, i) => [s.slug, shopDocs[i]]));

  // ---- buyers
  const buyerDocs = await User.insertMany(
    data.buyers.map((b, i) => {
      const addr = data.addresses[i % data.addresses.length];
      const addresses = [{ ...addr, addressType: "Home" }];
      if (i === 0) {
        addresses.push({
          address1: "500 Howard St", address2: "Floor 9", city: "San Francisco",
          country: "United States", zipCode: "94105", addressType: "Office",
        });
      }
      return {
        name: b.name,
        email: `${b.slug}@${data.DOMAIN}`,
        password: passwordHash,
        phoneNumber: b.phone,
        avatar: `user-${i + 1}.jpg`,
        addresses,
        createdAt: ago(int(20, 200)),
      };
    })
  );
  const reviewers = buyerDocs.slice(1);

  // ---- products (with reviews)
  const productDocs = [];
  for (const [idx, p] of data.products.entries()) {
    const shop = shopBySlug.get(p.shop);
    const pool = data.reviewText[p.category];
    const count = int(3, Math.min(8, pool.length));
    const picked = shuffle(pool).slice(0, count);
    const people = shuffle(reviewers).slice(0, count);
    const reviews = picked.map(([rating, comment], i) => ({
      user: { _id: people[i]._id, name: people[i].name, avatar: people[i].avatar },
      rating,
      comment,
      productId: "", // filled once the product has an id
      createdAt: ago(int(2, 95)),
    }));
    const avg = reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;

    productDocs.push({
      name: p.name,
      description: p.description,
      category: data.CATEGORIES[p.category],
      tags: p.tags,
      originalPrice: p.was,
      discountPrice: p.price,
      stock: p.stock,
      sold_out: p.sold,
      images: imagesFor(p.slug),
      reviews,
      ratings: Math.round(avg * 10) / 10,
      shopId: String(shop._id),
      shop: publicShop(shop),
      // spread over ~4 months; the last few land in "new arrivals"
      createdAt: idx % 7 === 0 ? ago(int(1, 9)) : ago(int(10, 120)),
    });
  }
  const products = await Product.insertMany(productDocs);
  for (const prod of products) {
    prod.reviews.forEach((r) => (r.productId = String(prod._id)));
    prod.markModified("reviews");
    await prod.save({ validateBeforeSave: false });
  }
  const productBySlug = new Map(data.products.map((p, i) => [p.slug, products[i]]));

  // ---- events
  const events = await Event.insertMany(
    data.events.map((e) => {
      const shop = shopBySlug.get(e.shop);
      const base = data.products.find((p) => p.slug === e.product);
      const start = ago(e.startedAgo);
      const finish = new Date(NOW + e.daysLeft * DAY);
      return {
        name: e.name,
        description: e.description,
        category: data.CATEGORIES[base.category],
        start_Date: start,
        Finish_Date: finish,
        tags: base.tags,
        originalPrice: base.was,
        discountPrice: e.price,
        stock: e.stock,
        sold_out: e.sold,
        images: imagesFor(e.product),
        shopId: String(shop._id),
        shop: publicShop(shop),
        createdAt: ago(5),
      };
    })
  );

  // ---- coupons
  await CouponCode.insertMany(
    data.coupons.map((c) => ({
      name: c.name,
      value: c.value,
      minAmount: c.minAmount,
      maxAmount: c.maxAmount,
      shopId: String(shopBySlug.get(c.shop)._id),
    }))
  );
  const couponByShop = new Map(
    data.coupons.map((c) => [String(shopBySlug.get(c.shop)._id), c])
  );

  // ---- orders
  const orders = [];
  const payouts = new Map();
  let ref = 100240;

  const makeOrders = (buyer, buyerIndex, ageDays) => {
    const picks = shuffle(products).slice(0, int(1, 3));
    const byShop = new Map();
    for (const prod of picks) {
      if (!byShop.has(prod.shopId)) byShop.set(prod.shopId, []);
      byShop.get(prod.shopId).push({ prod, qty: rand() < 0.8 ? 1 : 2 });
    }
    const addr = buyer.addresses[0].toObject();
    delete addr._id;
    delete addr.addressType;
    const useCard = rand() < 0.75;

    for (const [shopId, lines] of byShop) {
      const subTotal = round2(lines.reduce((a, l) => a + l.prod.discountPrice * l.qty, 0));
      let discount = 0;
      let couponCode;
      const coupon = couponByShop.get(shopId);
      if (coupon && subTotal >= coupon.minAmount && rand() < 0.2) {
        discount = round2(Math.min((subTotal * coupon.value) / 100, coupon.maxAmount));
        couponCode = coupon.name;
      }
      const shipping = subTotal >= 50 ? 0 : 4.99;
      const total = round2(subTotal - discount + shipping);

      const age = ageDays + rand() * 0.6;
      let status;
      if (age > 14) status = rand() < 0.94 ? "Delivered" : "Cancelled";
      else if (age > 7) status = pick(["Delivered", "Delivered", "Out for delivery", "Shipped"]);
      else if (age > 3) status = pick(["Shipped", "Out for delivery", "Packed"]);
      else status = pick(["Processing", "Processing", "Packed"]);

      const created = ago(age);
      const steps = ["Processing", "Packed", "Shipped", "Out for delivery", "Delivered"];
      const history = [{ status: "Processing", at: created }];
      if (status === "Cancelled") {
        history.push({ status: "Cancelled", at: new Date(created.getTime() + 5 * 3600 * 1000) });
      } else {
        for (let s = 1; s <= steps.indexOf(status); s++) {
          history.push({ status: steps[s], at: new Date(created.getTime() + s * 0.9 * DAY) });
        }
      }
      const delivered = status === "Delivered";
      const paid = delivered || (useCard && status !== "Cancelled");

      if (delivered) {
        payouts.set(shopId, (payouts.get(shopId) || 0) + round2(total * 0.9));
      }

      orders.push({
        orderRef: `VZ-${ref++}`,
        shopId,
        shop: publicShop(shopDocs.find((s) => String(s._id) === shopId)),
        cart: lines.map((l) => ({
          productId: String(l.prod._id),
          kind: "Product",
          name: l.prod.name,
          image: l.prod.images[0],
          price: l.prod.discountPrice,
          qty: l.qty,
          shopId,
        })),
        shippingAddress: addr,
        user: {
          _id: buyer._id,
          name: buyer.name,
          email: buyer.email,
          phoneNumber: buyer.phoneNumber,
          avatar: buyer.avatar,
        },
        subTotal,
        discount,
        shipping,
        couponCode,
        totalPrice: total,
        status,
        statusHistory: history,
        paymentInfo: {
          id: useCard ? `pi_demo_${ref}${int(1000, 9999)}` : undefined,
          type: useCard ? "Credit Card" : "Cash On Delivery",
          status: paid ? "Paid" : "Pending",
        },
        settled: delivered,
        paidAt: paid ? created : undefined,
        deliveredAt: delivered ? history[history.length - 1].at : undefined,
        createdAt: created,
      });
    }
  };

  // the demo buyer gets a spread of statuses to explore
  [3, 9, 16, 31, 55, 80, 120].forEach((d) => makeOrders(buyerDocs[0], 0, d));
  // everyone else: order history across ~5 months
  // skewed towards recent days so the revenue charts show a growing shop
  for (let i = 0; i < 360; i++) {
    const idx = int(1, buyerDocs.length - 1);
    makeOrders(buyerDocs[idx], idx, 165 * Math.pow(rand(), 1.6));
  }
  await Order.insertMany(orders);

  for (const [shopId, amount] of payouts) {
    await Shop.updateOne({ _id: shopId }, { $inc: { availableBalance: round2(amount) } });
  }

  console.log(
    `Seeded ${shopDocs.length} shops, ${buyerDocs.length} buyers, ${products.length} products, ` +
      `${events.length} events, ${data.coupons.length} coupons, ${orders.length} orders.`
  );
  console.log(`\nDemo logins (password: ${data.PASSWORD})`);
  console.log(`  Buyer : buyer@${data.DOMAIN}`);
  data.shops.forEach((s) => console.log(`  Seller: ${s.slug}@${data.DOMAIN}  (${s.name})`));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
