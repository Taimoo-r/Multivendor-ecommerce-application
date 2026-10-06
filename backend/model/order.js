const mongoose = require("mongoose");

const ORDER_STATUSES = [
  "Processing",
  "Packed",
  "Shipped",
  "Out for delivery",
  "Delivered",
  "Cancelled",
];

const orderSchema = new mongoose.Schema({
  orderRef: {
    type: String,
    index: true,
  },
  shopId: {
    type: String,
  },
  shop: {
    type: Object,
  },
  // snapshot of the purchased lines: { productId, name, image, price, qty, shopId }
  cart: {
    type: Array,
    required: true,
  },
  shippingAddress: {
    type: Object,
    required: true,
  },
  user: {
    type: Object,
    required: true,
  },
  subTotal: Number,
  discount: {
    type: Number,
    default: 0,
  },
  shipping: {
    type: Number,
    default: 0,
  },
  couponCode: String,
  totalPrice: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ORDER_STATUSES,
    default: "Processing",
  },
  statusHistory: [
    {
      status: String,
      at: { type: Date, default: Date.now },
    },
  ],
  paymentInfo: {
    id: {
      type: String,
    },
    status: {
      type: String,
    },
    type: {
      type: String,
    },
  },
  // seller payout was credited when the order was delivered
  settled: {
    type: Boolean,
    default: false,
  },
  paidAt: {
    type: Date,
  },
  deliveredAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

orderSchema.index({ shopId: 1, createdAt: -1 });
orderSchema.index({ "user._id": 1, createdAt: -1 });
// One payment can fund at most one order per shop. The database enforces it, so two
// requests replaying the same PaymentIntent cannot both create orders.
orderSchema.index(
  { "paymentInfo.id": 1, shopId: 1 },
  { unique: true, partialFilterExpression: { "paymentInfo.id": { $type: "string" } } }
);

module.exports = mongoose.model("Order", orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
