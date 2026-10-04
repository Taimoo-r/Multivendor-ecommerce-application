const express = require("express");
const catchAsyncError = require("../middleware/catchAsyncErrors");
const router = express.Router();
const CouponCode = require("../model/couponCode");
const ErrorHandler = require("../utils/ErrorHandler");
const { isSeller } = require("../middleware/auth");

// Create coupon code (for the signed-in shop)
// minAmount = minimum eligible spend, maxAmount = cap on the discount given
router.post(
  "/create-coupon-code",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    const { name, value, minAmount, maxAmount, selectedProduct } = req.body;
    if (!name || !String(name).trim()) {
      return next(new ErrorHandler("Please enter a coupon code", 400));
    }
    if (!(Number(value) > 0 && Number(value) <= 90)) {
      return next(new ErrorHandler("The discount must be between 1% and 90%", 400));
    }
    const code = String(name).trim().toUpperCase();
    if (await CouponCode.findOne({ name: code })) {
      return next(new ErrorHandler("That coupon code already exists", 400));
    }
    const couponCode = await CouponCode.create({
      name: code,
      value: Number(value),
      minAmount: minAmount ? Number(minAmount) : undefined,
      maxAmount: maxAmount ? Number(maxAmount) : undefined,
      selectedProduct: selectedProduct || undefined,
      shopId: String(req.seller._id),
    });
    res.status(201).json({ success: true, couponCode });
  })
);

// Coupons of the signed-in shop
router.get(
  "/get-coupon/:id",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    const couponCodes = await CouponCode.find({
      shopId: String(req.seller._id),
    }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, couponCodes });
  })
);

// Delete a coupon of the signed-in shop
router.delete(
  "/delete-coupon/:id",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    const couponCode = await CouponCode.findOneAndDelete({
      _id: req.params.id,
      shopId: String(req.seller._id),
    });
    if (!couponCode) {
      return next(new ErrorHandler("Coupon code doesn't exist", 404));
    }
    res.status(200).json({ success: true, message: "Coupon code deleted" });
  })
);

// Look up a coupon by name (checkout)
router.get(
  "/get-coupon-value/:name",
  catchAsyncError(async (req, res, next) => {
    const couponCode = await CouponCode.findOne({
      name: String(req.params.name).trim().toUpperCase(),
    });
    res.status(200).json({ success: true, couponCode });
  })
);

module.exports = router;
