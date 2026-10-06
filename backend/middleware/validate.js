const ErrorHandler = require("../utils/ErrorHandler");

// validate({ body, query, params }) runs each zod schema and replaces the input with the
// parsed result (trimmed, coerced, unknown fields rejected). Express 5 makes req.query
// read-only, so the parsed query is exposed as req.q.
const validate = (schemas) => (req, res, next) => {
  for (const part of ["params", "query", "body"]) {
    const schema = schemas[part];
    if (!schema) continue;
    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join(".") || part,
        message: i.message,
      }));
      return next(
        new ErrorHandler(details[0].message, 400, { code: "VALIDATION_ERROR", details })
      );
    }
    if (part === "query") req.q = result.data;
    else req[part] = result.data;
  }
  next();
};

module.exports = validate;
