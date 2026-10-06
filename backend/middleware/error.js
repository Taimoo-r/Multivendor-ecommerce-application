const ErrorHandler = require("../utils/ErrorHandler");

module.exports = (err, req, res, next) => {
  if (err.statusCode === undefined || err.statusCode >= 500) {
    console.error(err);
  }
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal Server Error";

  // wrong mongodb id
  if (err.name === "CastError") {
    err = new ErrorHandler(`Invalid ${err.path}`, 400);
  }

  // duplicate key
  if (err.code === 11000) {
    const keys = Object.keys(err.keyValue || err.keyPattern || {});
    err = keys.includes("paymentInfo.id")
      ? new ErrorHandler("This payment was already used for an order", 409, {
          code: "PAYMENT_ALREADY_USED",
        })
      : new ErrorHandler(`${keys[0] || "Value"} is already in use`, 409, {
          code: "DUPLICATE",
        });
  }

  // schema validation
  if (err.name === "ValidationError") {
    err = new ErrorHandler(
      Object.values(err.errors)
        .map((e) => e.message)
        .join(", "),
      400,
      { code: "VALIDATION_ERROR" }
    );
  }

  // wrong / expired jwt in emailed links (activation)
  if (err.name === "JsonWebTokenError") {
    err = new ErrorHandler("Your link is invalid, please try again", 400);
  }
  if (err.name === "TokenExpiredError") {
    err = new ErrorHandler("Your link has expired, please try again", 400);
  }

  // upload problems
  if (
    err.name === "MulterError" ||
    err.message === "Only image files are allowed"
  ) {
    err = new ErrorHandler(
      err.code === "LIMIT_FILE_SIZE"
        ? "Images must be 5MB or smaller"
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
          ? "Too many files"
          : err.message,
      400,
      { code: "UPLOAD_REJECTED" }
    );
  }

  const body = { success: false, message: err.message };
  if (err.code && typeof err.code === "string") body.code = err.code;
  if (err.details) body.details = err.details;
  if (err.scope) body.scope = err.scope;
  if (err.retryAfter) body.retryAfter = err.retryAfter;

  res.status(err.statusCode).json(body);
};
