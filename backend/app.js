const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

// Config (before the routes, which read env vars when they load)
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({
    path: ".env",
  });
}

const ErrorHandler = require("./middleware/error");
const app = express();

// Nginx sits in front of this server in production
app.set("trust proxy", 1);

// Middleware
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use("/uploads", express.static("uploads", { maxAge: "7d" }));

// Import routes
const user = require("./controller/user");
const shop = require("./controller/shop");
const product = require("./controller/product");
const event = require("./controller/event");
const coupon = require("./controller/couponCode");
const payment = require("./controller/payment");
const order = require("./controller/order");

app.get("/api/v1/health", (req, res) => res.json({ ok: true }));

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
  res.status(404).json({ success: false, message: "Route not found" });
});

// Error handling middleware
app.use(ErrorHandler);

module.exports = app;
