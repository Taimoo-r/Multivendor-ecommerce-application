// Category names must match the `category` stored on products (see backend seed + create-product).
export const CATEGORIES = [
  "Electronics",
  "Fashion",
  "Shoes",
  "Home & Living",
  "Beauty & Care",
  "Sports & Outdoors",
  "Kitchen & Coffee",
  "Gifts & Stationery",
];

// shorter labels for tight spaces such as the nav bar
export const CATEGORY_SHORT = {
  "Sports & Outdoors": "Sports",
  "Kitchen & Coffee": "Kitchen",
  "Gifts & Stationery": "Gifts",
};

export const FREE_SHIPPING_OVER = 50;
export const SHIPPING_FLAT = 4.99;

export const ORDER_STEPS = [
  "Processing",
  "Packed",
  "Shipped",
  "Out for delivery",
  "Delivered",
];

export const FAQ = [
  {
    q: "How long does delivery take?",
    a: "Most orders ship within 1-2 business days and arrive in 3-6 business days. Each shop packs and ships its own items, so an order with products from several shops may arrive in separate parcels.",
  },
  {
    q: "Is shipping free?",
    a: "Shipping is free on a shop's items when that shop's part of your order is over $50. Otherwise it is a flat $4.99 per shop.",
  },
  {
    q: "What is your returns policy?",
    a: "You can return most items within 30 days of delivery in their original condition. Contact the shop from your order page and they will send a prepaid label.",
  },
  {
    q: "How do coupon codes work?",
    a: "Coupons are issued by individual shops and apply to that shop's items. Enter the code at checkout and the discount appears before you pay. Some coupons have a minimum spend or a maximum discount.",
  },
  {
    q: "Can I cancel an order?",
    a: "Yes, while it is still Processing. Open the order from your profile and choose Cancel order. Once a shop has packed it, you can return it after delivery instead.",
  },
  {
    q: "How do I sell on VendorZone?",
    a: "Create a shop in a couple of minutes, add your products and start selling. You keep 90% of every order; we keep 10% to run the marketplace and payments.",
  },
  {
    q: "Is my payment secure?",
    a: "Card payments are handled by Stripe and your card details never touch our servers. You can also choose cash on delivery at checkout.",
  },
];
