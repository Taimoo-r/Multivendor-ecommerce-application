const express = require("express");
const router = express.Router();
const catchAsyncError = require("../middleware/catchAsyncErrors");
const { isAuthenticated } = require("../middleware/auth");
const { priceCart, summary } = require("../utils/pricing");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Create a PaymentIntent for the cart. The amount is computed on the server
// from database prices, so it can't be tampered with from the browser.
router.post(
  "/process",
  isAuthenticated,
  catchAsyncError(async (req, res, next) => {
    const priced = await priceCart(req.body.cart, req.body.couponCode);
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(priced.total * 100),
      currency: "usd",
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { userId: String(req.user._id), company: "VendorZone" },
    });
    res.status(200).json({
      success: true,
      client_secret: intent.client_secret,
      id: intent.id,
      summary: summary(priced),
    });
  })
);

router.get(
  "/stripeapikey",
  catchAsyncError(async (req, res, next) => {
    res.status(200).json({ stripeApikey: process.env.STRIPE_PUBLISHABLE_KEY });
  })
);

module.exports = router;
