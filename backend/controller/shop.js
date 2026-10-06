const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const sendMail = require("../utils/sendMail");
const Shop = require("../model/shop.js");
const Product = require("../model/product");
const Event = require("../model/event");
const { isSeller } = require("../middleware/auth");
const { upload } = require("../multer");
const catchAsyncError = require("../middleware/catchAsyncErrors");
const validate = require("../middleware/validate");
const { limits } = require("../middleware/rateLimit");
const schemas = require("../validation/schemas").shop;
const ErrorHandler = require("../utils/ErrorHandler");
const passwordResetHandlers = require("../utils/passwordReset");
const { publicShop } = require("../utils/publicShop");
const { verifyImages, queueVariants } = require("../utils/images");
const { removeImage } = require("../utils/catalog");
const { discardOnError } = require("./product");
const session = require("../utils/session");
const cache = require("../lib/cache");

const KIND = "shop";
const PUBLIC = "public, max-age=0, s-maxage=60, stale-while-revalidate=120";

const safeShop = (shop) => {
  const o = shop.toObject ? shop.toObject() : { ...shop };
  delete o.password;
  delete o.resetPasswordToken;
  delete o.resetPasswordTime;
  return o;
};

const signIn = async (req, res, shop, status = 200) => {
  await session.startSession(req, res, KIND, shop._id);
  res.status(status).json({ success: true, user: safeShop(shop) });
};

// The activation link carries the shop details, with the password already hashed.
const createActivationToken = (seller) =>
  jwt.sign(seller, process.env.ACTIVATION_SECRET, { expiresIn: process.env.ACTIVATION_EXPIRES });

// Create shop (sends an activation email)
router.post(
  "/create-shop",
  limits.signup,
  discardOnError,
  upload.single("file"),
  verifyImages,
  validate(schemas.register),
  catchAsyncError(async (req, res, next) => {
    const { name, email, password, address, phoneNumber, zipCode } = req.body;
    if (!req.file) return next(new ErrorHandler("Please upload a shop logo", 400, { code: "VALIDATION_ERROR" }));
    if (await Shop.exists({ email })) {
      return next(new ErrorHandler("A shop with this email already exists", 409, { code: "DUPLICATE" }));
    }

    const seller = {
      name,
      email,
      password: await bcrypt.hash(password, 10),
      avatar: req.file.filename,
      address,
      phoneNumber,
      zipCode,
    };
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const activationUrl = `${frontendUrl}/seller/activation/${createActivationToken(seller)}`;

    try {
      await sendMail({
        email: seller.email,
        subject: "Activate your VendorZone shop",
        message: `Hello ${seller.name},\n\nPlease click the link below to activate your shop:\n\n${activationUrl}\n\nThe link expires shortly. If you didn't sign up, you can ignore this email.`,
      });
    } catch {
      return next(new ErrorHandler("Could not send the activation email", 500));
    }
    queueVariants([req.file.filename]);
    res.status(201).json({
      success: true,
      message: `Please check your email (${seller.email}) to activate your shop`,
    });
  })
);

// Activate shop. The unique index on email settles a race between two clicks.
router.post(
  "/activation",
  limits.tokenLink,
  validate(schemas.activation),
  catchAsyncError(async (req, res, next) => {
    const { name, email, password, avatar, zipCode, address, phoneNumber } = jwt.verify(
      req.body.activation_token,
      process.env.ACTIVATION_SECRET
    );
    if (await Shop.exists({ email })) {
      return next(new ErrorHandler("This shop is already activated", 409, { code: "DUPLICATE" }));
    }
    const seller = new Shop({ name, email, password, avatar, zipCode, address, phoneNumber });
    seller.$locals.passwordHashed = true; // already hashed in create-shop
    await seller.save();
    await cache.del("shops:all");
    await signIn(req, res, seller, 201);
  })
);

// Login shop. Failed attempts are counted per IP + email and slowed down progressively.
router.post(
  "/login-shop",
  limits.loginIp,
  validate(schemas.login),
  limits.loginFailures,
  catchAsyncError(async (req, res, next) => {
    const { email, password } = req.body;
    const shop = await Shop.findOne({ email }).select("+password");
    if (!shop || !(await shop.comparePassword(password))) {
      return next(new ErrorHandler("Incorrect email or password", 401, { code: "BAD_CREDENTIALS" }));
    }
    await signIn(req, res, shop);
  })
);

// Exchange the refresh cookie for a new access token (and a rotated refresh token).
router.post(
  "/refresh",
  limits.refresh,
  catchAsyncError(async (req, res, next) => {
    const result = await session.rotate(req, res, KIND);
    if (!result.ok) {
      session.clearCookies(res, KIND);
      const message =
        result.code === "REFRESH_REUSED" ? "For your security you have been signed out" : "Please login to continue";
      return next(new ErrorHandler(message, 401, { code: result.code, scope: KIND }));
    }
    res.status(200).json({ success: true });
  })
);

// Forgot / reset password. A reset signs out every session.
const shopReset = passwordResetHandlers(Shop, {
  resetPath: "/shop-reset-password",
  onReset: (account) => session.revokeAll(KIND, account._id),
});
router.post(
  "/forgot-password",
  limits.forgotIp,
  validate(schemas.forgot),
  limits.forgotEmail,
  catchAsyncError(shopReset.forgot)
);
router.post(
  "/reset-password/:token",
  limits.tokenLink,
  validate(schemas.reset),
  catchAsyncError(shopReset.reset)
);

// Load shop (the signed-in seller)
router.get(
  "/getSeller",
  isSeller,
  catchAsyncError(async (req, res) => {
    res.status(200).json({ success: true, seller: safeShop(req.seller) });
  })
);

// Logout seller: revokes this session server-side.
router.post(
  "/logout",
  catchAsyncError(async (req, res) => {
    const sid = await session.currentSessionId(req, KIND);
    if (sid) await session.revokeSession(sid);
    session.clearCookies(res, KIND);
    res.status(200).json({ success: true, message: "Logged out" });
  })
);

// Per-shop numbers shown on public shop cards
const shopStats = async (shopIds) => {
  const rows = await Product.aggregate([
    { $match: { shopId: { $in: shopIds } } },
    {
      $group: {
        _id: "$shopId",
        products: { $sum: 1 },
        sold: { $sum: "$sold_out" },
        reviews: { $sum: { $size: { $ifNull: ["$reviews", []] } } },
        ratingSum: {
          $sum: {
            $multiply: [{ $ifNull: ["$ratings", 0] }, { $size: { $ifNull: ["$reviews", []] } }],
          },
        },
      },
    },
  ]);
  const map = new Map();
  for (const r of rows) {
    map.set(r._id, {
      products: r.products,
      sold: r.sold,
      reviews: r.reviews,
      rating: r.reviews ? Math.round((r.ratingSum / r.reviews) * 10) / 10 : 0,
    });
  }
  return map;
};
const emptyStats = { products: 0, sold: 0, reviews: 0, rating: 0 };

// All shops (public)
router.get(
  "/get-all-shops",
  limits.browse,
  catchAsyncError(async (req, res) => {
    const result = await cache.cached("shops:all", 60, async () => {
      const shops = await Shop.find({}, { name: 1, avatar: 1, description: 1, address: 1, createdAt: 1 })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean();
      const stats = await shopStats(shops.map((s) => String(s._id)));
      return shops.map((s) => ({ ...publicShop(s), stats: stats.get(String(s._id)) || emptyStats }));
    });
    res.set("Cache-Control", PUBLIC);
    cache.sendCached(res, result, (shops) => ({ success: true, shops }));
  })
);

// One shop (public)
router.get(
  "/get-shop-info/:id",
  limits.browse,
  validate(schemas.idParam),
  catchAsyncError(async (req, res, next) => {
    const { id } = req.params;
    const result = await cache.cached(`shop:${id}`, 60, async () => {
      const shop = await Shop.findById(id).lean();
      if (!shop) return null;
      const stats = await shopStats([String(shop._id)]);
      return { shop: publicShop(shop), stats: stats.get(String(shop._id)) || emptyStats };
    });
    if (!result.value) return next(new ErrorHandler("Shop not found", 404, { code: "NOT_FOUND" }));
    res.set("Cache-Control", PUBLIC);
    cache.sendCached(res, result, (v) => ({ success: true, ...v }));
  })
);

// Products and events carry a copy of the shop's public card; keep it in step.
const syncShopCopies = async (shop) => {
  const card = publicShop(shop);
  const id = String(shop._id);
  await Promise.all([
    Product.updateMany({ shopId: id }, { $set: { shop: card } }),
    Event.updateMany({ shopId: id }, { $set: { shop: card } }),
  ]);
  await cache.bump("p");
  await cache.del("shops:all", `shop:${id}`, "events:all", `events:shop:${id}`);
};

// Update shop logo
router.put(
  "/update-shop-avatar",
  isSeller,
  limits.upload,
  discardOnError,
  upload.single("image"),
  verifyImages,
  catchAsyncError(async (req, res, next) => {
    if (!req.file) return next(new ErrorHandler("Please choose an image", 400));
    const previous = req.seller.avatar;
    const shop = await Shop.findByIdAndUpdate(req.seller._id, { avatar: req.file.filename }, { new: true });
    queueVariants([shop.avatar]);
    await syncShopCopies(shop);
    removeImage(previous);
    res.status(200).json({ success: true, shop: safeShop(shop) });
  })
);

// Update shop details
router.put(
  "/update-seller-info",
  isSeller,
  limits.sellerWrite,
  validate(schemas.update),
  catchAsyncError(async (req, res) => {
    const shop = await Shop.findByIdAndUpdate(req.seller._id, req.body, { new: true, runValidators: true });
    await syncShopCopies(shop);
    res.status(200).json({ success: true, shop: safeShop(shop) });
  })
);

module.exports = router;
