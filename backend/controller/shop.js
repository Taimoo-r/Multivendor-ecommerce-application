const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const sendMail = require("../utils/sendMail");
const Shop = require("../model/shop.js");
const Product = require("../model/product");
const { isSeller } = require("../middleware/auth");
const { upload } = require("../multer");
const catchAsyncError = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const sendShopToken = require("../utils/shopToken");
const passwordResetHandlers = require("../utils/passwordReset");
const { publicShop } = require("../utils/publicShop");

const MIN_PASSWORD_LENGTH = 6;

const removeUpload = (filename) => {
  if (!filename) return;
  fs.unlink(path.join("uploads", filename), () => {});
};

// Create activation token. The password is hashed first so the emailed link
// never contains it in readable form.
const createActivationToken = (seller) =>
  jwt.sign(seller, process.env.ACTIVATION_SECRET, {
    expiresIn: process.env.ACTIVATION_EXPIRES,
  });

// Create shop (sends an activation email)
router.post(
  "/create-shop",
  upload.single("file"),
  catchAsyncError(async (req, res, next) => {
    const { name, email, password, address, phoneNumber, zipCode } = req.body;
    const cleanup = () => removeUpload(req.file && req.file.filename);

    if (!name || !email || !password || !address || !phoneNumber || !zipCode) {
      cleanup();
      return next(new ErrorHandler("Please fill in all the fields", 400));
    }
    if (!req.file) {
      return next(new ErrorHandler("Please upload a shop logo", 400));
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      cleanup();
      return next(
        new ErrorHandler(
          `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          400
        )
      );
    }

    const cleanEmail = String(email).toLowerCase();
    if (await Shop.findOne({ email: cleanEmail })) {
      cleanup();
      return next(new ErrorHandler("A shop with this email already exists", 400));
    }

    const seller = {
      name,
      email: cleanEmail,
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
    } catch (error) {
      cleanup();
      return next(new ErrorHandler("Could not send the activation email", 500));
    }
    res.status(201).json({
      success: true,
      message: `Please check your email (${seller.email}) to activate your shop`,
    });
  })
);

// Activate shop
router.post(
  "/activation",
  catchAsyncError(async (req, res, next) => {
    const { activation_token } = req.body;
    const newSeller = jwt.verify(activation_token, process.env.ACTIVATION_SECRET);
    if (!newSeller) {
      return next(new ErrorHandler("Invalid token", 400));
    }

    const { name, email, password, avatar, zipCode, address, phoneNumber } =
      newSeller;
    if (await Shop.findOne({ email })) {
      return next(new ErrorHandler("This shop is already activated", 400));
    }

    const seller = new Shop({
      name,
      email,
      password,
      avatar,
      zipCode,
      address,
      phoneNumber,
    });
    seller.$locals.passwordHashed = true; // already hashed in create-shop
    await seller.save();

    sendShopToken(seller, 201, res);
  })
);

// Login shop
router.post(
  "/login-shop",
  catchAsyncError(async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new ErrorHandler("Please provide all the fields!", 400));
    }

    const shop = await Shop.findOne({ email: String(email).toLowerCase() }).select(
      "+password"
    );
    if (!shop || !(await shop.comparePassword(password))) {
      return next(new ErrorHandler("Incorrect email or password", 400));
    }

    sendShopToken(shop, 201, res);
  })
);

// Forgot / reset password
const shopReset = passwordResetHandlers(Shop, {
  resetPath: "/shop-reset-password",
});
router.post("/forgot-password", catchAsyncError(shopReset.forgot));
router.post("/reset-password/:token", catchAsyncError(shopReset.reset));

// Load shop (the signed-in seller)
router.get(
  "/getSeller",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    res.status(200).json({ success: true, seller: req.seller });
  })
);

// Logout seller
router.get(
  "/logout",
  catchAsyncError(async (req, res, next) => {
    res.clearCookie("seller_token", { httpOnly: true });
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
            $multiply: [
              { $ifNull: ["$ratings", 0] },
              { $size: { $ifNull: ["$reviews", []] } },
            ],
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
  catchAsyncError(async (req, res, next) => {
    const shops = await Shop.find().sort({ createdAt: 1 });
    const stats = await shopStats(shops.map((s) => String(s._id)));
    res.status(200).json({
      success: true,
      shops: shops.map((s) => ({
        ...publicShop(s),
        stats: stats.get(String(s._id)) || emptyStats,
      })),
    });
  })
);

// One shop (public)
router.get(
  "/get-shop-info/:id",
  catchAsyncError(async (req, res, next) => {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return next(new ErrorHandler("Shop not found", 404));
    const stats = await shopStats([String(shop._id)]);
    res.status(200).json({
      success: true,
      shop: publicShop(shop),
      stats: stats.get(String(shop._id)) || emptyStats,
    });
  })
);

// Update shop logo
router.put(
  "/update-shop-avatar",
  isSeller,
  upload.single("image"),
  catchAsyncError(async (req, res, next) => {
    if (!req.file) {
      return next(new ErrorHandler("Please choose an image", 400));
    }
    const previous = req.seller.avatar;
    const shop = await Shop.findByIdAndUpdate(
      req.seller._id,
      { avatar: req.file.filename },
      { new: true }
    );
    removeUpload(previous);
    res.status(200).json({ success: true, shop });
  })
);

// Update shop details
router.put(
  "/update-seller-info",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    const { name, description, address, phoneNumber, zipCode } = req.body;
    if (!name || !address || !phoneNumber || !zipCode) {
      return next(new ErrorHandler("Please fill in all the required fields", 400));
    }
    const shop = await Shop.findByIdAndUpdate(
      req.seller._id,
      { name, description, address, phoneNumber, zipCode },
      { new: true, runValidators: true }
    );
    res.status(200).json({ success: true, shop });
  })
);

module.exports = router;
