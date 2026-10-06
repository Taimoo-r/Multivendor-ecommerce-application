const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const ErrorHandler = require("./ErrorHandler");
const sendMail = require("./sendMail");

const RESET_WINDOW_MS = 15 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

// Only the hash is stored, so a leaked database can't be used to reset accounts.
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

// Forgot/reset handlers shared by buyers (User) and sellers (Shop).
// resetPath is the frontend route that receives the emailed token.
//
// Updates go through updateOne with a pre-hashed password instead of save(), so
// the models' pre-save hooks never run on these partial updates.
// onReset(account) runs after a successful reset, e.g. to sign out every session.
const passwordResetHandlers = (Model, { resetPath, onReset }) => ({
  forgot: async (req, res, next) => {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    if (!email) {
      return next(new ErrorHandler("Please enter your email", 400));
    }

    const account = await Model.findOne({ email });

    // Same response whether or not the email exists, so it can't be probed.
    if (account) {
      const token = crypto.randomBytes(32).toString("hex");
      await Model.updateOne(
        { _id: account._id },
        {
          $set: {
            resetPasswordToken: hashToken(token),
            resetPasswordTime: new Date(Date.now() + RESET_WINDOW_MS),
          },
        }
      );

      const base = process.env.FRONTEND_URL || "http://localhost:5173";
      const resetUrl = `${base}${resetPath}/${token}`;

      try {
        await sendMail({
          email: account.email,
          subject: "Reset your password",
          message: `Hello ${account.name},\n\nWe received a request to reset your password. Use the link below within 15 minutes:\n\n${resetUrl}\n\nIf you didn't ask for this, you can ignore this email.`,
        });
      } catch (error) {
        await Model.updateOne(
          { _id: account._id },
          { $unset: { resetPasswordToken: "", resetPasswordTime: "" } }
        );
        return next(new ErrorHandler("Could not send the reset email", 500));
      }
    }

    res.status(200).json({
      success: true,
      message: "If that email is registered, a reset link is on its way.",
    });
  },

  reset: async (req, res, next) => {
    const { password } = req.body;
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return next(
        new ErrorHandler(
          `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          400
        )
      );
    }

    const account = await Model.findOne({
      resetPasswordToken: hashToken(req.params.token),
      resetPasswordTime: { $gt: new Date() },
    });
    if (!account) {
      return next(
        new ErrorHandler("This reset link is invalid or has expired", 400)
      );
    }

    await Model.updateOne(
      { _id: account._id },
      {
        $set: { password: await bcrypt.hash(password, 10) },
        $unset: { resetPasswordToken: "", resetPasswordTime: "" },
      }
    );
    if (onReset) await onReset(account);

    res.status(200).json({
      success: true,
      message: "Password updated. You can log in now.",
    });
  },
});

module.exports = passwordResetHandlers;
