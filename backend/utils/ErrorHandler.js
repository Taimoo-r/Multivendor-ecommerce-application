// An error with an HTTP status and, optionally, a machine-readable `code`
// (e.g. TOKEN_EXPIRED, RATE_LIMITED, VALIDATION_ERROR) plus extra fields for the client.
class ErrorHandler extends Error {
  constructor(message, statusCode, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    Object.assign(this, extra);
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ErrorHandler;
