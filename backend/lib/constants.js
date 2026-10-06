// Must match frontend/src/lib/constants.js
const CATEGORIES = [
  "Electronics",
  "Fashion",
  "Shoes",
  "Home & Living",
  "Beauty & Care",
  "Sports & Outdoors",
  "Kitchen & Coffee",
  "Gifts & Stationery",
];

const ORDER_STATUSES = [
  "Processing",
  "Packed",
  "Shipped",
  "Out for delivery",
  "Delivered",
  "Cancelled",
];

const PRODUCT_SORTS = ["featured", "best", "new", "price-asc", "price-desc", "rating", "discount"];

module.exports = { CATEGORIES, ORDER_STATUSES, PRODUCT_SORTS };
