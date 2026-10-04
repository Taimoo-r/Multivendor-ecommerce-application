const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated, isSeller } = require("../middleware/auth");
const Order = require("../model/order");
const Product = require("../model/product");
const Shop = require("../model/shop");
const Event = require("../model/event");
const CouponCode = require("../model/couponCode");
const { ORDER_STATUSES } = require("../model/order");
const { priceCart, summary } = require("../utils/pricing");
const { publicShop } = require("../utils/publicShop");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PLATFORM_FEE = 0.1; // share of each delivered order kept by the marketplace
const FORWARD = [
  "Processing",
  "Packed",
  "Shipped",
  "Out for delivery",
  "Delivered",
];

const orderRef = () =>
  `VZ-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

// Price a cart without placing anything (cart page / checkout summary).
router.post(
  "/quote",
  catchAsyncErrors(async (req, res, next) => {
    const priced = await priceCart(req.body.cart, req.body.couponCode);
    res.status(200).json({ success: true, summary: summary(priced) });
  })
);

// Place an order: one order per shop, prices recomputed on the server,
// stock decremented in the same transaction.
router.post(
  "/create-order",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    const { cart, shippingAddress, couponCode, paymentInfo } = req.body;

    const required = ["address1", "city", "country", "zipCode"];
    if (
      !shippingAddress ||
      required.some((k) => !String(shippingAddress[k] || "").trim())
    ) {
      return next(
        new ErrorHandler("Please provide a complete delivery address", 400)
      );
    }

    const priced = await priceCart(cart, couponCode);

    const type = paymentInfo && paymentInfo.type;
    let payment;
    if (type === "Cash On Delivery") {
      payment = { type, status: "Pending" };
    } else if (type === "Credit Card") {
      let intent;
      try {
        intent = await stripe.paymentIntents.retrieve(paymentInfo.id);
      } catch (e) {
        return next(new ErrorHandler("Payment could not be verified", 400));
      }
      if (
        intent.status !== "succeeded" ||
        intent.amount !== Math.round(priced.total * 100) ||
        intent.metadata.userId !== String(req.user._id)
      ) {
        return next(new ErrorHandler("Payment could not be verified", 400));
      }
      if (await Order.findOne({ "paymentInfo.id": intent.id })) {
        return next(
          new ErrorHandler("This payment was already used for an order", 400)
        );
      }
      payment = { id: intent.id, type, status: "Paid" };
    } else {
      return next(new ErrorHandler("Please choose a payment method", 400));
    }

    const shops = await Shop.find({
      _id: { $in: priced.orders.map((o) => o.shopId) },
    });
    const shopById = new Map(shops.map((s) => [String(s._id), s]));
    const user = {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phoneNumber: req.user.phoneNumber,
      avatar: req.user.avatar,
    };

    const session = await mongoose.startSession();
    let created = [];
    try {
      await session.withTransaction(async () => {
        created = [];
        for (const o of priced.orders) {
          for (const line of o.lines) {
            const Model = line.kind === "Event" ? Event : Product;
            const result = await Model.updateOne(
              { _id: line.product._id, stock: { $gte: line.qty } },
              { $inc: { stock: -line.qty, sold_out: line.qty } },
              { session }
            );
            if (result.modifiedCount !== 1) {
              throw new ErrorHandler(`${line.product.name} just sold out`, 409);
            }
          }
          const [order] = await Order.create(
            [
              {
                orderRef: orderRef(),
                shopId: o.shopId,
                shop: publicShop(shopById.get(o.shopId)),
                cart: o.lines.map((l) => ({
                  productId: String(l.product._id),
                  kind: l.kind,
                  name: l.product.name,
                  image: l.product.images[0],
                  price: l.price,
                  qty: l.qty,
                  shopId: o.shopId,
                })),
                shippingAddress,
                user,
                subTotal: o.subTotal,
                discount: o.discount,
                shipping: o.shipping,
                couponCode: o.discount > 0 ? priced.couponCode : undefined,
                totalPrice: o.total,
                paymentInfo: payment,
                paidAt: payment.status === "Paid" ? new Date() : undefined,
                statusHistory: [{ status: "Processing" }],
              },
            ],
            { session }
          );
          created.push(order);
        }
      });
    } finally {
      await session.endSession();
    }

    res
      .status(201)
      .json({ success: true, orders: created, summary: summary(priced) });
  })
);

// Orders of a user
router.get(
  "/get-all-orders/:userId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    if (String(req.user._id) !== req.params.userId) {
      return next(new ErrorHandler("Not allowed", 403));
    }
    const orders = await Order.find({ "user._id": req.user._id }).sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, orders });
  })
);

// Orders of a shop
router.get(
  "/get-seller-all-orders/:shopId",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    if (String(req.seller._id) !== req.params.shopId) {
      return next(new ErrorHandler("Not allowed", 403));
    }
    const orders = await Order.find({ shopId: req.params.shopId }).sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, orders });
  })
);

const restock = async (order) => {
  await Promise.all(
    order.cart.map((l) =>
      (l.kind === "Event" ? Event : Product).updateOne(
        { _id: l.productId },
        { $inc: { stock: l.qty, sold_out: -l.qty } }
      )
    )
  );
};

// Seller moves an order along its workflow (or cancels it)
router.put(
  "/update-order-status/:id",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    const { status } = req.body;
    if (!ORDER_STATUSES.includes(status)) {
      return next(new ErrorHandler("Unknown order status", 400));
    }
    const order = await Order.findById(req.params.id);
    if (!order || order.shopId !== String(req.seller._id)) {
      return next(new ErrorHandler("Order not found", 404));
    }
    if (order.status === "Delivered" || order.status === "Cancelled") {
      return next(
        new ErrorHandler(
          `This order is already ${order.status.toLowerCase()}`,
          400
        )
      );
    }
    if (
      status !== "Cancelled" &&
      FORWARD.indexOf(status) <= FORWARD.indexOf(order.status)
    ) {
      return next(new ErrorHandler("An order can only move forward", 400));
    }

    order.status = status;
    order.statusHistory.push({ status });

    if (status === "Cancelled") {
      await restock(order);
    }
    if (status === "Delivered") {
      order.deliveredAt = new Date();
      if (order.paymentInfo.status !== "Paid") {
        order.paymentInfo.status = "Paid";
        order.paidAt = new Date();
      }
      if (!order.settled) {
        order.settled = true;
        const payout =
          Math.round(order.totalPrice * (1 - PLATFORM_FEE) * 100) / 100;
        await Shop.updateOne(
          { _id: req.seller._id },
          { $inc: { availableBalance: payout } }
        );
      }
    }
    await order.save();
    res.status(200).json({ success: true, order });
  })
);

// Buyer cancels an order that hasn't been packed yet
router.put(
  "/cancel-order/:id",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    const order = await Order.findById(req.params.id);
    if (!order || String(order.user._id) !== String(req.user._id)) {
      return next(new ErrorHandler("Order not found", 404));
    }
    if (order.status !== "Processing") {
      return next(
        new ErrorHandler(
          "This order is already being prepared and can no longer be cancelled",
          400
        )
      );
    }
    order.status = "Cancelled";
    order.statusHistory.push({ status: "Cancelled" });
    await restock(order);
    await order.save();
    res.status(200).json({ success: true, order });
  })
);

// Dashboard numbers for the seller overview
router.get(
  "/seller-stats",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    const shopId = String(req.seller._id);
    const [orders, products, events, coupons] = await Promise.all([
      Order.find({ shopId }).sort({ createdAt: -1 }),
      Product.countDocuments({ shopId }),
      Event.countDocuments({ shopId }),
      CouponCode.countDocuments({ shopId }),
    ]);

    const live = orders.filter((o) => o.status !== "Cancelled");
    const delivered = orders.filter((o) => o.status === "Delivered");

    // revenue per month for the last 6 months (delivered orders)
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString("en-US", { month: "short" }),
        revenue: 0,
        orders: 0,
      });
    }
    for (const o of live) {
      const d = new Date(o.createdAt);
      const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) {
        m.orders += 1;
        if (o.status === "Delivered") m.revenue += o.totalPrice;
      }
    }

    res.status(200).json({
      success: true,
      stats: {
        revenue:
          Math.round(delivered.reduce((a, o) => a + o.totalPrice, 0) * 100) /
          100,
        balance: req.seller.availableBalance || 0,
        orders: orders.length,
        pending: orders.filter((o) =>
          ["Processing", "Packed"].includes(o.status)
        ).length,
        delivered: delivered.length,
        products,
        events,
        coupons,
        months: months.map((m) => ({
          ...m,
          revenue: Math.round(m.revenue * 100) / 100,
        })),
        recent: orders.slice(0, 6),
      },
    });
  })
);

module.exports = router;
