const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const { isSeller, isAuthenticated } = require("../middleware/auth");
const catchAsyncError = require("../middleware/catchAsyncErrors");
const Product = require("../model/product");
const Order = require("../model/order");
const { upload } = require("../multer");
const ErrorHandler = require("../utils/ErrorHandler");
const { publicShop, withPublicShop } = require("../utils/publicShop");

const removeUpload = (filename) => {
  if (!filename) return;
  fs.unlink(path.join("uploads", filename), () => {});
};

// Create product (signed-in seller, for their own shop)
router.post(
  "/create-product",
  isSeller,
  upload.array("images", 6),
  catchAsyncError(async (req, res, next) => {
    const files = req.files || [];
    const { name, description, category, tags, originalPrice, discountPrice, stock } =
      req.body;
    const fail = (message) => {
      files.forEach((f) => removeUpload(f.filename));
      return next(new ErrorHandler(message, 400));
    };

    if (!name || !description || !category) {
      return fail("Please fill in the name, description and category");
    }
    if (files.length === 0) return fail("Please add at least one image");
    if (!(Number(discountPrice) > 0)) return fail("Please enter a valid price");
    if (!(Number(stock) >= 0) || stock === "" || stock === undefined) {
      return fail("Please enter the stock quantity");
    }
    if (originalPrice && Number(originalPrice) < Number(discountPrice)) {
      return fail("The original price can't be lower than the sale price");
    }

    const product = await Product.create({
      name,
      description,
      category,
      tags,
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      discountPrice: Number(discountPrice),
      stock: Number(stock),
      images: files.map((f) => f.filename),
      shopId: String(req.seller._id),
      shop: publicShop(req.seller),
    });

    res.status(201).json({ success: true, product });
  })
);

// All products of a shop
router.get(
  "/get-all-products-shop/:id",
  catchAsyncError(async (req, res, next) => {
    const products = await Product.find({ shopId: req.params.id }).sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, products: products.map(withPublicShop) });
  })
);

// All products
router.get(
  "/get-all-products",
  catchAsyncError(async (req, res, next) => {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, product: products.map(withPublicShop) });
  })
);

// Delete a product of the signed-in shop
router.delete(
  "/delete-shop-product/:id",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return next(new ErrorHandler("Product not found", 404));
    }
    if (String(product.shopId) !== String(req.seller._id)) {
      return next(new ErrorHandler("You can only delete your own products", 403));
    }
    product.images.forEach(removeUpload);
    await Product.findByIdAndDelete(product._id);
    res.status(200).json({ success: true, message: "Product deleted" });
  })
);

// Review a product you've received. One review per buyer; reviewing again edits it.
router.put(
  "/create-new-review",
  isAuthenticated,
  catchAsyncError(async (req, res, next) => {
    const { rating, comment, productId } = req.body;
    const stars = Number(rating);
    if (!(stars >= 1 && stars <= 5)) {
      return next(new ErrorHandler("Please choose a rating from 1 to 5", 400));
    }

    const product = await Product.findById(productId);
    if (!product) {
      return next(new ErrorHandler("Product not found", 404));
    }

    const purchased = await Order.findOne({
      "user._id": req.user._id,
      status: "Delivered",
      "cart.productId": String(product._id),
    });
    if (!purchased) {
      return next(
        new ErrorHandler("You can review a product once your order has been delivered", 403)
      );
    }

    const author = {
      _id: req.user._id,
      name: req.user.name,
      avatar: req.user.avatar,
    };
    const existing = product.reviews.find(
      (r) => r.user && String(r.user._id) === String(req.user._id)
    );
    if (existing) {
      existing.rating = stars;
      existing.comment = comment;
      existing.user = author;
    } else {
      product.reviews.push({
        user: author,
        rating: stars,
        comment,
        productId: String(product._id),
      });
    }

    const total = product.reviews.reduce((a, r) => a + r.rating, 0);
    product.ratings = Math.round((total / product.reviews.length) * 10) / 10;
    await product.save({ validateBeforeSave: false });

    res.status(200).json({ success: true, message: "Thanks for your review!" });
  })
);

module.exports = router;
