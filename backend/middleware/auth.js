const ErrorHandler = require("../utils/ErrorHandler");
const jwt = require("jsonwebtoken");
const catchAsyncError = require("./catchAsyncErrors");
const User = require("../model/User");
const Shop = require("../model/shop");

// Middleware to authenticate regular users
exports.isAuthenticated = catchAsyncError(async (req, res, next) => {
  const { token } = req.cookies;

  if (!token) {
    return next(new ErrorHandler("Please login to continue", 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  } catch (error) {
    return next(new ErrorHandler("Your session has expired, please login again", 401));
  }

  req.user = await User.findById(decoded.id);
  if (!req.user) {
    return next(new ErrorHandler("Please login to continue", 401));
  }
  next();
});

// Middleware to authenticate sellers
exports.isSeller = catchAsyncError(async (req, res, next) => {
  const { seller_token } = req.cookies;

  if (!seller_token) {
    return next(new ErrorHandler("Please login to continue", 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(seller_token, process.env.JWT_SECRET_KEY);
  } catch (error) {
    return next(new ErrorHandler("Your session has expired, please login again", 401));
  }

  req.seller = await Shop.findById(decoded.id);
  if (!req.seller) {
    return next(new ErrorHandler("Please login to continue", 401));
  }
  next();
});
