const mongoose = require("mongoose");

// One document per sign-in ("token family"). Only hashes of refresh tokens are stored.
const sessionSchema = new mongoose.Schema({
  kind: { type: String, enum: ["user", "shop"], required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, required: true }, // user or shop id
  tokenHash: { type: String, required: true }, // current refresh token
  prevHash: { type: String }, // the one it replaced (grace window + reuse detection)
  rotatedAt: { type: Date },
  revokedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
  userAgent: String,
  ip: String,
  createdAt: { type: Date, default: Date.now },
});

sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ prevHash: 1 }, { sparse: true });
sessionSchema.index({ kind: 1, subject: 1 });
// MongoDB deletes a session once it expires
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Session", sessionSchema);
