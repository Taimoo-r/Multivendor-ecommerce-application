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
    err = new ErrorHandler(
      `${Object.keys(err.keyValue)[0]} is already in use`,
      400
    );
  }

  // schema validation
  if (err.name === "ValidationError") {
    err = new ErrorHandler(
      Object.values(err.errors)
        .map((e) => e.message)
        .join(", "),
      400
    );
  }

  // wrong / expired jwt
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
        : err.message,
      400
    );
  }

  res.status(err.statusCode).json({
    success: false,
    message: err.message,
  });
};
