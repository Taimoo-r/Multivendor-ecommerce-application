// Request schemas. Objects are strict: an unknown field is a 400, which also blocks
// mass assignment (e.g. sending { role: "admin" } or { availableBalance: 1e6 }).
const { z } = require("zod");
const { CATEGORIES, ORDER_STATUSES, PRODUCT_SORTS } = require("../lib/constants");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address"));
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");
const anyPassword = z.string().min(1, "Enter your password").max(128);
const name = z.string().trim().min(1, "Name is required").max(80);
const phone = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).replace(/[\s()+-]/g, ""))
  .refine((v) => v === "" || /^\d{7,15}$/.test(v), "Enter a valid phone number");
const zip = z.string().trim().regex(/^[A-Za-z0-9 -]{3,10}$/, "Enter a valid postal code");
const money = z.coerce.number().positive("Enter a valid price").max(1_000_000);
const optionalMoney = z
  .union([z.literal(""), z.coerce.number().positive().max(1_000_000)])
  .optional()
  .transform((v) => (v === "" ? undefined : v));
const token = z.string().regex(/^[a-f0-9]{64}$/i, "This link is invalid");

const strict = (shape) => z.object(shape).strict();

// ---- users
const user = {
  register: { body: strict({ name, email, password }) },
  login: { body: strict({ email, password: anyPassword }) },
  activation: { body: strict({ activation_token: z.string().min(20).max(4096) }) },
  forgot: { body: strict({ email }) },
  reset: { params: strict({ token }), body: strict({ password }) },
  updateInfo: {
    body: strict({
      name: name.optional(),
      email: email.optional(),
      phoneNumber: phone.optional(),
      password: anyPassword.optional(),
    }),
  },
  updatePassword: {
    body: strict({
      oldPassword: anyPassword,
      newPassword: password,
      confirmPassword: z.string().max(128),
    }).refine((b) => b.newPassword === b.confirmPassword, {
      message: "The new passwords don't match",
      path: ["confirmPassword"],
    }),
  },
  address: {
    body: strict({
      _id: objectId.optional(),
      country: z.string().trim().min(2).max(60),
      city: z.string().trim().min(1).max(80),
      address1: z.string().trim().min(3).max(120),
      address2: z.string().trim().max(120).optional().default(""),
      zipCode: zip,
      addressType: z.enum(["Home", "Office", "Default"]),
    }),
  },
  idParam: { params: strict({ id: objectId }) },
};

// ---- shops
const shop = {
  login: user.login,
  activation: user.activation,
  forgot: user.forgot,
  reset: user.reset,
  register: {
    body: strict({
      name: z.string().trim().min(2).max(80),
      email,
      password,
      address: z.string().trim().min(5).max(160),
      phoneNumber: phone,
      zipCode: zip,
    }),
  },
  update: {
    body: strict({
      name: z.string().trim().min(2).max(80),
      description: z.string().trim().max(1000).optional().default(""),
      address: z.string().trim().min(5).max(160),
      phoneNumber: phone,
      zipCode: zip,
    }),
  },
  idParam: { params: strict({ id: objectId }) },
};

// ---- catalogue
const flag = z.enum(["0", "1"]).optional();
const product = {
  create: {
    body: strict({
      name: z.string().trim().min(2).max(140),
      description: z.string().trim().min(10, "Description is too short").max(5000),
      category: z.enum(CATEGORIES, "Choose a category"),
      tags: z.string().trim().max(300).optional(),
      originalPrice: optionalMoney,
      discountPrice: money,
      stock: z.coerce.number().int().min(0).max(100_000),
    }).refine((b) => !b.originalPrice || b.originalPrice >= b.discountPrice, {
      message: "The original price can't be lower than the sale price",
      path: ["originalPrice"],
    }),
  },
  list: {
    query: strict({
      q: z.string().trim().max(80).optional(),
      category: z.enum(CATEGORIES).optional(),
      shop: objectId.optional(),
      sort: z.enum(PRODUCT_SORTS).optional().default("featured"),
      min: z.coerce.number().min(0).optional(),
      max: z.coerce.number().min(0).optional(),
      rating: z.coerce.number().int().min(0).max(5).optional(),
      sale: flag,
      stock: flag,
      limit: z.coerce.number().int().min(1).max(48).optional().default(24),
      cursor: z.string().max(300).optional(),
    }),
  },
  facets: { query: strict({ q: z.string().trim().max(80).optional() }) },
  lookup: {
    query: strict({
      ids: z
        .string()
        .max(50 * 25)
        .transform((s) => [...new Set(s.split(",").filter(Boolean))])
        .pipe(z.array(objectId).min(1).max(50)),
    }),
  },
  review: {
    body: strict({
      productId: objectId,
      rating: z.coerce.number().int().min(1).max(5),
      comment: z.string().trim().max(1000).optional().default(""),
    }),
  },
  idParam: { params: strict({ id: objectId }) },
  shopParam: { params: strict({ shopId: objectId }) },
};

const isoDate = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Enter a valid date");

const event = {
  create: {
    body: strict({
      name: z.string().trim().min(2).max(140),
      description: z.string().trim().min(10).max(5000),
      category: z.enum(CATEGORIES, "Choose a category"),
      tags: z.string().trim().max(300).optional(),
      originalPrice: optionalMoney,
      discountPrice: money,
      stock: z.coerce.number().int().min(1).max(100_000),
      start_Date: isoDate,
      Finish_Date: isoDate,
    }).refine((b) => Date.parse(b.Finish_Date) > Date.parse(b.start_Date), {
      message: "The event must end after it starts",
      path: ["Finish_Date"],
    }),
  },
  idParam: { params: strict({ id: objectId }) },
};

const coupon = {
  create: {
    body: strict({
      name: z.string().trim().regex(/^[A-Za-z0-9_-]{3,30}$/, "Use 3-30 letters, digits, - or _"),
      value: z.coerce.number().int().min(1).max(90),
      minAmount: optionalMoney,
      maxAmount: optionalMoney,
      selectedProduct: z.union([z.literal(""), objectId]).optional(),
    }),
  },
  nameParam: { params: strict({ name: z.string().trim().min(1).max(30) }) },
  idParam: { params: strict({ id: objectId }) },
};

// ---- orders and payments
const cart = z
  .array(strict({ _id: objectId, qty: z.coerce.number().int().min(1).max(99) }))
  .min(1, "Your cart is empty")
  .max(50, "Too many items in one order");
const couponCode = z.string().trim().max(30).optional();

// cursor pagination for order lists; without `limit` the first 500 come back (old clients)
const pageQuery = strict({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().max(200).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
});

const order = {
  quote: { body: strict({ cart, couponCode }) },
  create: {
    body: strict({
      cart,
      couponCode,
      shippingAddress: strict({
        address1: z.string().trim().min(3).max(120),
        address2: z.string().trim().max(120).optional(),
        city: z.string().trim().min(1).max(80),
        country: z.string().trim().min(2).max(60),
        zipCode: zip,
        phoneNumber: phone.optional(),
      }),
      paymentInfo: z.discriminatedUnion("type", [
        strict({ type: z.literal("Cash On Delivery") }),
        strict({ type: z.literal("Credit Card"), id: z.string().regex(/^pi_[A-Za-z0-9_]+$/) }),
      ]),
    }),
  },
  status: {
    params: strict({ id: objectId }),
    body: strict({ status: z.enum(ORDER_STATUSES) }),
  },
  idParam: { params: strict({ id: objectId }) },
  userParam: { params: strict({ userId: objectId }), query: pageQuery },
  shopParam: { params: strict({ shopId: objectId }), query: pageQuery },
};

module.exports = { user, shop, product, event, coupon, order };
