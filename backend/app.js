const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");

// Config (before the routes, which read env vars when they load)
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({
    path: ".env",
  });
}

const ErrorHandler = require("./middleware/error");
const { limits } = require("./middleware/rateLimit");
const { getRedis } = require("./lib/redis");
const app = express();

getRedis(); // connect early; everything still works while it is unavailable

// Nginx sits in front of this server in production
app.set("trust proxy", 1);
app.disable("x-powered-by");

// The API only returns JSON, so its CSP can be "nothing at all". The page CSP is set
// by Nginx on the HTML (deploy/nginx/vendorzone.conf).
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    frameguard: { action: "deny" },
    crossOriginResourcePolicy: { policy: "same-site" },
  })
);

// Middleware
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Upload names are unique and never reused, so they can be cached for a year.
app.use(
  "/uploads",
  express.static("uploads", { maxAge: "365d", immutable: true, fallthrough: false })
);

// Import routes
const user = require("./controller/user");
const shop = require("./controller/shop");
const product = require("./controller/product");
const event = require("./controller/event");
const coupon = require("./controller/couponCode");
const payment = require("./controller/payment");
const order = require("./controller/order");

app.get("/api/v1/health", (req, res) => res.json({ ok: true }));

// API responses are personal or fast-changing unless a route says otherwise
// (public catalogue reads set their own Cache-Control).
app.use("/api", limits.api, (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Mount routes
app.use("/api/v1/user", user);
app.use("/api/v1/shop", shop);
app.use("/api/v1/product", product);
app.use("/api/v1/event", event);
app.use("/api/v1/coupon", coupon);
app.use("/api/v1/payment", payment);
app.use("/api/v1/order", order);

// Unknown API routes get a clean JSON 404
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found", code: "NOT_FOUND" });
});

// Error handling middleware
app.use(ErrorHandler);

module.exports = app;
