const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter your product name!"],
  },
  description: {
    type: String,
    required: [true, "Please enter your product description!"],
  },
  category: {
    type: String,
    required: [true, "Please enter your product category!"],
  },
  tags: {
    type: String,
  },
  originalPrice: {
    type: Number,
  },
  discountPrice: {
    type: Number,
    required: [true, "Please enter your product price!"],
  },
  stock: {
    type: Number,
    required: [true, "Please enter your product stock!"],
  },
  images: [
    {
      type: String,
    },
  ],
  reviews: [
    {
      user: {
        type: Object,
      },
      rating: {
        type: Number,
      },
      comment: {
        type: String,
      },
      productId: {
        type: String,
      },
      createdAt: {
        type: Date,
        default: Date.now(),
      },
    },
  ],
  ratings: {
    type: Number,
    default: 0,
  },
  // stored so "biggest discount" can be an indexed sort
  discountPct: {
    type: Number,
    default: 0,
  },
  shopId: {
    type: String,
    required: true,
  },
  shop: {
    type: Object,
    required: true,
  },
  sold_out: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

productSchema.pre("validate", function () {
  this.discountPct =
    this.originalPrice && this.originalPrice > this.discountPrice
      ? Math.round(((this.originalPrice - this.discountPrice) / this.originalPrice) * 100)
      : 0;
});

// One compound index per allowed sort, each ending in _id so cursor pagination has a
// stable tie-breaker; the category-prefixed versions serve the filtered pages.
const SORT_KEYS = [
  { createdAt: -1, _id: -1 },
  { sold_out: -1, _id: -1 },
  { discountPrice: 1, _id: 1 }, // also walked backwards for price high-to-low
  { ratings: -1, _id: -1 },
  { discountPct: -1, _id: -1 },
];
for (const key of SORT_KEYS) {
  productSchema.index(key);
  productSchema.index({ category: 1, ...key });
}
productSchema.index({ shopId: 1, createdAt: -1 });

module.exports = mongoose.model("Product", productSchema);