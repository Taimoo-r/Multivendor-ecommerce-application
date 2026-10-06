const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const fsp = require("fs/promises");
const router = express.Router();
const { isSeller, isAuthenticated } = require("../middleware/auth");
const catchAsyncError = require("../middleware/catchAsyncErrors");
const validate = require("../middleware/validate");
const { limits } = require("../middleware/rateLimit");
const schemas = require("../validation/schemas").product;
const Product = require("../model/product");
const Event = require("../model/event");
const Order = require("../model/order");
const { upload } = require("../multer");
const ErrorHandler = require("../utils/ErrorHandler");
const { publicShop, withPublicShop } = require("../utils/publicShop");
const { verifyImages, queueVariants, uploadedFiles } = require("../utils/images");
const { presentEvent, removeImage } = require("../utils/catalog");
const { CATEGORIES } = require("../lib/constants");
const cache = require("../lib/cache");

const PUBLIC = "public, max-age=0, s-maxage=30, stale-while-revalidate=60";
const QUERY_TIME_MS = 3000;

// sort name -> [field, direction]; every pair has a matching compound index (model/product.js)
const SORTS = {
  featured: ["sold_out", -1],
  best: ["sold_out", -1],
  new: ["createdAt", -1],
  "price-asc": ["discountPrice", 1],
  "price-desc": ["discountPrice", -1],
  rating: ["ratings", -1],
  discount: ["discountPct", -1],
};

// What a product card needs (about 250 bytes) instead of the whole document.
const CARD = {
  name: 1,
  images: { $slice: ["$images", 2] },
  discountPrice: 1,
  originalPrice: 1,
  discountPct: 1,
  ratings: 1,
  reviewCount: { $size: { $ifNull: ["$reviews", []] } },
  stock: 1,
  sold_out: 1,
  category: 1,
  shopId: 1,
  shop: { _id: "$shop._id", name: "$shop.name" },
  createdAt: 1,
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hashKey = (o) => crypto.createHash("sha1").update(JSON.stringify(o)).digest("hex");

function buildFilter(q) {
  const f = {};
  if (q.category) f.category = q.category;
  if (q.shop) f.shopId = q.shop;
  if (q.min !== undefined || q.max !== undefined) {
    f.discountPrice = {};
    if (q.min !== undefined) f.discountPrice.$gte = q.min;
    if (q.max !== undefined) f.discountPrice.$lte = q.max;
  }
  if (q.rating) f.ratings = { $gte: q.rating };
  if (q.sale === "1") f.discountPct = { $gt: 0 };
  if (q.stock === "1") f.stock = { $gt: 0 };
  if (q.q) {
    // Substring search is fine for a catalogue this size (bounded by maxTimeMS,
    // the rate limit and the cache). At scale this becomes a text index or Atlas Search.
    const re = new RegExp(escapeRegex(q.q), "i");
    f.$or = [{ name: re }, { tags: re }, { category: re }, { "shop.name": re }];
  }
  return f;
}

const encodeCursor = (v, id) => Buffer.from(JSON.stringify({ v, id })).toString("base64url");
function decodeCursor(cursor, field) {
  try {
    const { v, id } = JSON.parse(Buffer.from(cursor, "base64url").toString());
    if (!/^[a-f\d]{24}$/i.test(id)) throw new Error();
    return { v: field === "createdAt" ? new Date(v) : v, id: new mongoose.Types.ObjectId(id) };
  } catch {
    throw new ErrorHandler("Invalid page cursor", 400, { code: "VALIDATION_ERROR" });
  }
}

// Keyset pagination: "after the last row I saw", never skip/offset.
async function listProducts(q) {
  const [field, dir] = SORTS[q.sort] || SORTS.featured;
  const filter = buildFilter(q);
  const match = { ...filter };
  if (q.cursor) {
    const c = decodeCursor(q.cursor, field);
    const op = dir < 0 ? "$lt" : "$gt";
    match.$and = [{ $or: [{ [field]: { [op]: c.v } }, { [field]: c.v, _id: { [op]: c.id } }] }];
  }
  const rows = await Product.aggregate([
    { $match: match },
    { $sort: { [field]: dir, _id: dir } },
    { $limit: q.limit + 1 },
    { $project: CARD },
  ]).option({ maxTimeMS: QUERY_TIME_MS });

  const more = rows.length > q.limit;
  const page = more ? rows.slice(0, q.limit) : rows;
  const last = page[page.length - 1];
  return {
    products: page,
    nextCursor: more && last ? encodeCursor(last[field], String(last._id)) : null,
    // counting is as expensive as the query, so only the first page carries it
    total: q.cursor ? null : await Product.countDocuments(filter).maxTimeMS(QUERY_TIME_MS),
  };
}

// ---------------------------------------------------------------- public reads

router.get(
  "/list",
  limits.browse,
  validate(schemas.list),
  catchAsyncError(async (req, res) => {
    const ver = await cache.version("p");
    const result = await cache.cached(`p:list:${ver}:${hashKey(req.q)}`, 30, () => listProducts(req.q));
    res.set("Cache-Control", PUBLIC);
    cache.sendCached(res, result, (v) => ({ success: true, ...v }));
  })
);

router.get(
  "/facets",
  limits.browse,
  validate(schemas.facets),
  catchAsyncError(async (req, res) => {
    const ver = await cache.version("p");
    const result = await cache.cached(`p:facets:${ver}:${hashKey(req.q)}`, 300, async () => {
      const rows = await Product.aggregate([
        { $match: buildFilter({ q: req.q.q }) },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]).option({ maxTimeMS: QUERY_TIME_MS });
      return Object.fromEntries(rows.map((r) => [r._id, r.count]));
    });
    res.set("Cache-Control", PUBLIC);
    cache.sendCached(res, result, (counts) => ({ success: true, counts }));
  })
);

// Everything the home page shows, in one cached response.
router.get(
  "/home",
  limits.browse,
  catchAsyncError(async (req, res) => {
    const ver = await cache.version("p");
    const result = await cache.cached(`p:home:${ver}`, 60, async () => {
      const top = (q) => listProducts({ limit: 12, ...q }).then((r) => r.products);
      const [deals, best, fresh, electronics, style, home, thumbs] = await Promise.all([
        top({ sort: "discount", stock: "1" }),
        top({ sort: "best" }),
        top({ sort: "new" }),
        top({ sort: "best", category: "Electronics" }),
        Product.aggregate([
          { $match: { category: { $in: ["Fashion", "Shoes"] } } },
          { $sort: { sold_out: -1, _id: -1 } },
          { $limit: 12 },
          { $project: CARD },
        ]),
        Product.aggregate([
          { $match: { category: { $in: ["Home & Living", "Kitchen & Coffee"] } } },
          { $sort: { sold_out: -1, _id: -1 } },
          { $limit: 12 },
          { $project: CARD },
        ]),
        Product.aggregate([
          { $sort: { sold_out: -1 } },
          { $group: { _id: "$category", image: { $first: { $arrayElemAt: ["$images", 0] } } } },
        ]),
      ]);
      const categoryImages = Object.fromEntries(thumbs.map((t) => [t._id, t.image]));
      return { deals, best, fresh, electronics, style, home, categoryImages, categories: CATEGORIES };
    });
    res.set("Cache-Control", PUBLIC);
    cache.sendCached(res, result, (sections) => ({ success: true, ...sections }));
  })
);

// One product or event (ids are unique across both), with reviews newest first.
router.get(
  "/item/:id",
  limits.browse,
  validate(schemas.idParam),
  catchAsyncError(async (req, res, next) => {
    const { id } = req.params;
    const result = await cache.cached(`p:item:${id}`, 15, async () => {
      const product = await Product.findById(id).lean();
      if (product) {
        const item = withPublicShop(product);
        item.reviews = (item.reviews || [])
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 50);
        return { kind: "Product", item };
      }
      const event = await Event.findById(id).lean();
      return event ? { kind: "Event", item: presentEvent(event) } : null; // null is cached too
    });
    if (!result.value) return next(new ErrorHandler("Product not found", 404, { code: "NOT_FOUND" }));
    res.set("Cache-Control", "public, max-age=0, s-maxage=15");
    cache.sendCached(res, result, (v) => ({ success: true, ...v }));
  })
);

// Live price and stock for the ids in a cart or wishlist. Not cached: it feeds checkout.
router.get(
  "/lookup",
  limits.browse,
  validate(schemas.lookup),
  catchAsyncError(async (req, res) => {
    const ids = req.q.ids;
    const light = { name: 1, images: { $slice: 2 }, discountPrice: 1, originalPrice: 1, stock: 1, shopId: 1, "shop._id": 1, "shop.name": 1, category: 1, ratings: 1 };
    const [products, events] = await Promise.all([
      Product.find({ _id: { $in: ids } }, { ...light, reviewCount: { $size: { $ifNull: ["$reviews", []] } } }).lean(),
      Event.find({ _id: { $in: ids } }, { ...light, start_Date: 1, Finish_Date: 1 }).lean(),
    ]);
    const items = [
      ...products.map((p) => ({ ...p, kind: "Product" })),
      ...events.map((e) => ({ ...presentEvent(e), kind: "Event" })),
    ];
    res.set("Cache-Control", "private, no-store");
    res.json({ success: true, items });
  })
);

// Latest reviews across one shop's products (shop page).
router.get(
  "/shop-reviews/:shopId",
  limits.browse,
  validate(schemas.shopParam),
  catchAsyncError(async (req, res) => {
    const { shopId } = req.params;
    const result = await cache.cached(`shop-reviews:${shopId}`, 300, () =>
      Product.aggregate([
        { $match: { shopId } },
        { $unwind: "$reviews" },
        { $sort: { "reviews.createdAt": -1 } },
        { $limit: 12 },
        { $project: { _id: 0, review: "$reviews", product: { _id: "$_id", name: "$name" } } },
      ])
    );
    res.set("Cache-Control", PUBLIC);
    cache.sendCached(res, result, (reviews) => ({ success: true, reviews }));
  })
);

// All products of a shop (seller dashboard, small and always fresh)
router.get(
  "/get-all-products-shop/:id",
  validate(schemas.idParam),
  catchAsyncError(async (req, res) => {
    const products = await Product.aggregate([
      { $match: { shopId: req.params.id } },
      { $sort: { createdAt: -1 } },
      { $addFields: { reviewCount: { $size: { $ifNull: ["$reviews", []] } } } },
      { $project: { reviews: 0 } },
    ]);
    res.status(200).json({ success: true, products: products.map(withPublicShop) });
  })
);

// ---------------------------------------------------------------- writes

const invalidateCatalogue = async (shopId, ...productIds) => {
  await cache.bump("p");
  await cache.del("shops:all", `shop:${shopId}`, `shop-reviews:${shopId}`, ...productIds.map((id) => `p:item:${id}`));
};

// Delete uploaded files if the request ends in an error after multer stored them.
const discardOnError = (req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode >= 400) uploadedFiles(req).forEach((f) => fsp.unlink(f.path).catch(() => {}));
  });
  next();
};

router.post(
  "/create-product",
  isSeller,
  limits.sellerWrite,
  limits.upload,
  discardOnError,
  upload.array("images", 6),
  verifyImages,
  validate(schemas.create),
  catchAsyncError(async (req, res, next) => {
    const files = req.files || [];
    if (files.length === 0) return next(new ErrorHandler("Please add at least one image", 400, { code: "VALIDATION_ERROR" }));

    const product = await Product.create({
      ...req.body,
      images: files.map((f) => f.filename),
      shopId: String(req.seller._id),
      shop: publicShop(req.seller),
    });
    queueVariants(product.images);
    await invalidateCatalogue(product.shopId, product._id);
    res.status(201).json({ success: true, product });
  })
);

router.delete(
  "/delete-shop-product/:id",
  isSeller,
  limits.sellerWrite,
  validate(schemas.idParam),
  catchAsyncError(async (req, res, next) => {
    const product = await Product.findById(req.params.id);
    if (!product) return next(new ErrorHandler("Product not found", 404));
    if (String(product.shopId) !== String(req.seller._id)) {
      return next(new ErrorHandler("You can only delete your own products", 403));
    }
    await Product.findByIdAndDelete(product._id);
    product.images.forEach(removeImage);
    await invalidateCatalogue(product.shopId, product._id);
    res.status(200).json({ success: true, message: "Product deleted" });
  })
);

// Review a product you've received. One review per buyer; reviewing again edits it.
router.put(
  "/create-new-review",
  isAuthenticated,
  limits.review,
  validate(schemas.review),
  catchAsyncError(async (req, res, next) => {
    const { rating, comment, productId } = req.body;
    const product = await Product.findById(productId);
    if (!product) return next(new ErrorHandler("Product not found", 404));

    const purchased = await Order.findOne({
      "user._id": req.user._id,
      status: "Delivered",
      "cart.productId": String(product._id),
    });
    if (!purchased) {
      return next(new ErrorHandler("You can review a product once your order has been delivered", 403));
    }

    const author = { _id: req.user._id, name: req.user.name, avatar: req.user.avatar };
    const existing = product.reviews.find((r) => r.user && String(r.user._id) === String(req.user._id));
    if (existing) {
      existing.rating = rating;
      existing.comment = comment;
      existing.user = author;
    } else {
      product.reviews.push({ user: author, rating, comment, productId: String(product._id) });
    }
    const total = product.reviews.reduce((a, r) => a + r.rating, 0);
    product.ratings = Math.round((total / product.reviews.length) * 10) / 10;
    await product.save({ validateBeforeSave: false });
    await invalidateCatalogue(product.shopId, product._id);

    res.status(200).json({ success: true, message: "Thanks for your review!" });
  })
);

module.exports = router;
module.exports.invalidateCatalogue = invalidateCatalogue;
module.exports.discardOnError = discardOnError;
