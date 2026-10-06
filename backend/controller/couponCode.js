const express = require("express");
const catchAsyncError = require("../middleware/catchAsyncErrors");
const router = express.Router();
const validate = require("../middleware/validate");
const { limits } = require("../middleware/rateLimit");
const schemas = require("../validation/schemas").coupon;
const CouponCode = require("../model/couponCode");
const ErrorHandler = require("../utils/ErrorHandler");
const { isSeller } = require("../middleware/auth");

// Create coupon code (for the signed-in shop)
// minAmount = minimum eligible spend, maxAmount = cap on the discount given
router.post(
  "/create-coupon-code",
  isSeller,
  limits.sellerWrite,
  validate(schemas.create),
  catchAsyncError(async (req, res, next) => {
    const { name, value, minAmount, maxAmount, selectedProduct } = req.body;
    const code = name.toUpperCase();
    if (await CouponCode.exists({ name: code })) {
      return next(new ErrorHandler("That coupon code already exists", 409, { code: "DUPLICATE" }));
    }
    const couponCode = await CouponCode.create({
      name: code,
      value,
      minAmount,
      maxAmount,
      selectedProduct: selectedProduct || undefined,
      shopId: String(req.seller._id),
    });
    res.status(201).json({ success: true, couponCode });
  })
);

// Coupons of the signed-in shop (the :id is kept for old clients and ignored)
router.get(
  "/get-coupon/:id",
  isSeller,
  catchAsyncError(async (req, res) => {
    const couponCodes = await CouponCode.find({ shopId: String(req.seller._id) })
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, couponCodes });
  })
);

// Delete a coupon of the signed-in shop
router.delete(
  "/delete-coupon/:id",
  isSeller,
  limits.sellerWrite,
  validate(schemas.idParam),
  catchAsyncError(async (req, res, next) => {
    const couponCode = await CouponCode.findOneAndDelete({
      _id: req.params.id,
      shopId: String(req.seller._id),
    });
    if (!couponCode) return next(new ErrorHandler("Coupon code doesn't exist", 404));
    res.status(200).json({ success: true, message: "Coupon code deleted" });
  })
);

// Look up a coupon by name (checkout). Rate limited per IP so codes can't be enumerated.
router.get(
  "/get-coupon-value/:name",
  limits.couponLookup,
  validate(schemas.nameParam),
  catchAsyncError(async (req, res) => {
    const couponCode = await CouponCode.findOne(
      { name: req.params.name.toUpperCase() },
      { name: 1, value: 1, minAmount: 1, maxAmount: 1, selectedProduct: 1, shopId: 1 }
    ).lean();
    res.status(200).json({ success: true, couponCode });
  })
);

module.exports = router;
