const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const validate = require("../middleware/validate");
const { limits } = require("../middleware/rateLimit");
const schemas = require("../validation/schemas").order;
const cache = require("../lib/cache");
const { isAuthenticated, isSeller } = require("../middleware/auth");
const Order = require("../model/order");
const Product = require("../model/product");
const Shop = require("../model/shop");
const Event = require("../model/event");
const CouponCode = require("../model/couponCode");
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

// Stock and sold counts changed: drop the cached product pages. Lists and the home page
// are allowed to be up to 30-60 s behind; the item page and checkout are not.
const invalidateItems = (lines) => cache.del(...lines.map((l) => `p:item:${l.productId || l.product._id}`));

// Cursor pages over an order list, newest first: ?limit=50&cursor=...
const encodeCursor = (o) => Buffer.from(JSON.stringify({ t: o.createdAt, id: String(o._id) })).toString("base64url");
async function pageOrders(filter, q) {
  const limit = q.limit || 500;
  const match = { ...filter };
  if (q.status) match.status = q.status;
  if (q.cursor) {
    let c;
    try {
      c = JSON.parse(Buffer.from(q.cursor, "base64url").toString());
      if (!/^[a-f\d]{24}$/i.test(c.id)) throw new Error();
    } catch {
      throw new ErrorHandler("Invalid page cursor", 400, { code: "VALIDATION_ERROR" });
    }
    const t = new Date(c.t);
    const id = new mongoose.Types.ObjectId(c.id);
    match.$or = [{ createdAt: { $lt: t } }, { createdAt: t, _id: { $lt: id } }];
  }
  const rows = await Order.find(match).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
  const more = rows.length > limit;
  const orders = more ? rows.slice(0, limit) : rows;
  return {
    orders,
    nextCursor: more ? encodeCursor(orders[orders.length - 1]) : null,
    total: q.cursor ? null : await Order.countDocuments(match),
  };
}

const orderRef = () =>
  `VZ-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

// Price a cart without placing anything (cart page / checkout summary).
router.post(
  "/quote",
  limits.quote,
  validate(schemas.quote),
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
  limits.checkout,
  validate(schemas.create),
  catchAsyncErrors(async (req, res, next) => {
    const { cart, shippingAddress, couponCode, paymentInfo } = req.body;

    const priced = await priceCart(cart, couponCode);

    const type = paymentInfo.type;
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
      // fast path; the unique index on (paymentInfo.id, shopId) is the real guarantee
      if (await Order.exists({ "paymentInfo.id": intent.id })) {
        return next(
          new ErrorHandler("This payment was already used for an order", 409, { code: "PAYMENT_ALREADY_USED" })
        );
      }
      payment = { id: intent.id, type, status: "Paid" };
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
    await invalidateItems(priced.orders.flatMap((o) => o.lines));

    res
      .status(201)
      .json({ success: true, orders: created, summary: summary(priced) });
  })
);

// Orders of a user
router.get(
  "/get-all-orders/:userId",
  isAuthenticated,
  validate(schemas.userParam),
  catchAsyncErrors(async (req, res, next) => {
    if (String(req.user._id) !== req.params.userId) {
      return next(new ErrorHandler("Not allowed", 403));
    }
    const page = await pageOrders({ "user._id": req.user._id }, req.q);
    res.status(200).json({ success: true, ...page });
  })
);

// Orders of a shop
router.get(
  "/get-seller-all-orders/:shopId",
  isSeller,
  validate(schemas.shopParam),
  catchAsyncErrors(async (req, res, next) => {
    if (String(req.seller._id) !== req.params.shopId) {
      return next(new ErrorHandler("Not allowed", 403));
    }
    const page = await pageOrders({ shopId: req.params.shopId }, req.q);
    res.status(200).json({ success: true, ...page });
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
  await invalidateItems(order.cart);
};

// Seller moves an order along its workflow (or cancels it)
router.put(
  "/update-order-status/:id",
  isSeller,
  limits.sellerWrite,
  validate(schemas.status),
  catchAsyncErrors(async (req, res, next) => {
    const { status } = req.body;
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
  validate(schemas.idParam),
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
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    // aggregated in the database instead of loading every order of the shop
    const [byStatus, monthly, recent, products, events, coupons] = await Promise.all([
      Order.aggregate([
        { $match: { shopId } },
        { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$totalPrice" } } },
      ]),
      Order.aggregate([
        { $match: { shopId, createdAt: { $gte: since }, status: { $ne: "Cancelled" } } },
        {
          $group: {
            _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } },
            orders: { $sum: 1 },
            revenue: { $sum: { $cond: [{ $eq: ["$status", "Delivered"] }, "$totalPrice", 0] } },
          },
        },
      ]),
      Order.find({ shopId }).sort({ createdAt: -1 }).limit(6).lean(),
      Product.countDocuments({ shopId }),
      Event.countDocuments({ shopId }),
      CouponCode.countDocuments({ shopId }),
    ]);

    const status = Object.fromEntries(byStatus.map((r) => [r._id, r]));
    const count = (...names) => names.reduce((a, n) => a + (status[n]?.count || 0), 0);
    const round = (n) => Math.round(n * 100) / 100;

    // revenue per month for the last 6 months (delivered orders)
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const row = monthly.find((r) => r._id.y === d.getFullYear() && r._id.m === d.getMonth() + 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString("en-US", { month: "short" }),
        revenue: round(row?.revenue || 0),
        orders: row?.orders || 0,
      });
    }

    res.status(200).json({
      success: true,
      stats: {
        revenue: round(status.Delivered?.total || 0),
        balance: req.seller.availableBalance || 0,
        orders: byStatus.reduce((a, r) => a + r.count, 0),
        pending: count("Processing", "Packed"),
        delivered: count("Delivered"),
        products,
        events,
        coupons,
        months,
        recent,
      },
    });
  })
);

module.exports = router;
