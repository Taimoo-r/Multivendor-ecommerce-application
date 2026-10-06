const jwt = require("jsonwebtoken");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncError = require("./catchAsyncErrors");
const User = require("../model/User");
const Shop = require("../model/shop");
const { COOKIES, isRevoked } = require("../utils/session");

// 401 codes the client acts on:
//   TOKEN_EXPIRED    the access token is out of date: refresh and retry
//   UNAUTHENTICATED  no usable credentials: sign in
//   SESSION_REVOKED  signed out elsewhere or detected as stolen: sign in
const authenticate = (kind, Model, field) =>
  catchAsyncError(async (req, res, next) => {
    const token = req.cookies[COOKIES[kind].access];
    const scope = kind;
    if (!token) {
      return next(new ErrorHandler("Please login to continue", 401, { code: "UNAUTHENTICATED", scope }));
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (e) {
      if (e.name === "TokenExpiredError") {
        return next(new ErrorHandler("Your session needs refreshing", 401, { code: "TOKEN_EXPIRED", scope }));
      }
      return next(new ErrorHandler("Please login to continue", 401, { code: "UNAUTHENTICATED", scope }));
    }

    // tokens issued before sessions existed carry no sid and are no longer accepted
    if (!payload.sid || payload.kind !== kind) {
      return next(new ErrorHandler("Please login to continue", 401, { code: "UNAUTHENTICATED", scope }));
    }
    if (await isRevoked(payload.sid)) {
      return next(new ErrorHandler("You have been signed out", 401, { code: "SESSION_REVOKED", scope }));
    }

    const subject = await Model.findById(payload.id);
    if (!subject) {
      return next(new ErrorHandler("Please login to continue", 401, { code: "UNAUTHENTICATED", scope }));
    }
    req[field] = subject;
    req.sessionId = payload.sid;
    next();
  });

exports.isAuthenticated = authenticate("user", User, "user");
exports.isSeller = authenticate("shop", Shop, "seller");
