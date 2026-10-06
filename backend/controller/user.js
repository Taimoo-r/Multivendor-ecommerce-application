const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const User = require("../model/User");
const { upload } = require("../multer");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncError = require("../middleware/catchAsyncErrors");
const validate = require("../middleware/validate");
const { limits } = require("../middleware/rateLimit");
const schemas = require("../validation/schemas").user;
const sendMail = require("../utils/sendMail");
const { isAuthenticated } = require("../middleware/auth");
const passwordResetHandlers = require("../utils/passwordReset");
const { verifyImages, queueVariants } = require("../utils/images");
const { removeImage } = require("../utils/catalog");
const { discardOnError } = require("./product");
const session = require("../utils/session");

const DEFAULT_AVATAR = "default-avatar.jpg";
const KIND = "user";

const removeAvatar = (filename) => {
  if (filename && filename !== DEFAULT_AVATAR) removeImage(filename);
};

const safeUser = (user) => {
  const o = user.toObject ? user.toObject() : { ...user };
  delete o.password;
  delete o.resetPasswordToken;
  delete o.resetPasswordTime;
  return o;
};

const signIn = async (req, res, user, status = 200) => {
  await session.startSession(req, res, KIND, user._id);
  res.status(status).json({ success: true, user: safeUser(user) });
};

// The activation link carries the account details, with the password already hashed.
const createActivationToken = (user) =>
  jwt.sign(user, process.env.ACTIVATION_SECRET, { expiresIn: process.env.ACTIVATION_EXPIRES });

// Create user (sends an activation email)
router.post(
  "/create-user",
  limits.signup,
  discardOnError,
  upload.single("file"),
  verifyImages,
  validate(schemas.register),
  catchAsyncError(async (req, res, next) => {
    const { name, email, password } = req.body;
    if (await User.exists({ email })) {
      return next(new ErrorHandler("An account with this email already exists", 409, { code: "DUPLICATE" }));
    }

    const user = {
      name,
      email,
      password: await bcrypt.hash(password, 10),
      avatar: req.file ? req.file.filename : DEFAULT_AVATAR,
    };
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const activationUrl = `${frontendUrl}/activation/${createActivationToken(user)}`;

    try {
      await sendMail({
        email: user.email,
        subject: "Activate your VendorZone account",
        message: `Hello ${user.name},\n\nPlease click the link below to activate your account:\n\n${activationUrl}\n\nThe link expires shortly. If you didn't sign up, you can ignore this email.`,
      });
    } catch {
      return next(new ErrorHandler("Could not send the activation email", 500));
    }
    if (req.file) queueVariants([req.file.filename]);
    res.status(201).json({
      success: true,
      message: `Please check your email (${user.email}) to activate your account`,
    });
  })
);

// Activate user
router.post(
  "/activation",
  limits.tokenLink,
  validate(schemas.activation),
  catchAsyncError(async (req, res, next) => {
    const { name, email, password, avatar } = jwt.verify(
      req.body.activation_token,
      process.env.ACTIVATION_SECRET
    );
    if (await User.exists({ email })) {
      return next(new ErrorHandler("This account is already activated", 409, { code: "DUPLICATE" }));
    }
    const user = new User({ name, email, password, avatar });
    user.$locals.passwordHashed = true; // already hashed in create-user
    await user.save();
    await signIn(req, res, user, 201);
  })
);

// Forgot / reset password. A reset signs out every session.
const userReset = passwordResetHandlers(User, {
  resetPath: "/reset-password",
  onReset: (account) => session.revokeAll(KIND, account._id),
});
router.post(
  "/forgot-password",
  limits.forgotIp,
  validate(schemas.forgot),
  limits.forgotEmail,
  catchAsyncError(userReset.forgot)
);
router.post(
  "/reset-password/:token",
  limits.tokenLink,
  validate(schemas.reset),
  catchAsyncError(userReset.reset)
);

// Login user. Failed attempts are counted per IP + email and slowed down progressively.
router.post(
  "/login-user",
  limits.loginIp,
  validate(schemas.login),
  limits.loginFailures,
  catchAsyncError(async (req, res, next) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return next(new ErrorHandler("Incorrect email or password", 401, { code: "BAD_CREDENTIALS" }));
    }
    await signIn(req, res, user);
  })
);

// Exchange the refresh cookie for a new access token (and a rotated refresh token).
router.post(
  "/refresh",
  limits.refresh,
  catchAsyncError(async (req, res, next) => {
    const result = await session.rotate(req, res, KIND);
    if (!result.ok) {
      session.clearCookies(res, KIND);
      const message =
        result.code === "REFRESH_REUSED" ? "For your security you have been signed out" : "Please login to continue";
      return next(new ErrorHandler(message, 401, { code: result.code, scope: KIND }));
    }
    res.status(200).json({ success: true });
  })
);

// Load user
router.get(
  "/load-user",
  isAuthenticated,
  catchAsyncError(async (req, res) => {
    res.status(200).json({ success: true, user: safeUser(req.user) });
  })
);

// Logout: revokes this session server-side, so neither token works afterwards.
// POST so a cross-site <img src> can't sign people out.
router.post(
  "/logout",
  catchAsyncError(async (req, res) => {
    const sid = await session.currentSessionId(req, KIND);
    if (sid) await session.revokeSession(sid);
    session.clearCookies(res, KIND);
    res.status(200).json({ success: true, message: "Logged out" });
  })
);

// Update profile details. Changing the email requires the current password.
router.put(
  "/update-user-info",
  isAuthenticated,
  validate(schemas.updateInfo),
  catchAsyncError(async (req, res, next) => {
    const { name, email, phoneNumber, password } = req.body;
    const user = await User.findById(req.user._id).select("+password");

    if (name !== undefined) user.name = name;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber === "" ? undefined : Number(phoneNumber);

    if (email !== undefined && email !== user.email) {
      if (!password || !(await user.comparePassword(password))) {
        return next(new ErrorHandler("Enter your current password to change your email", 400));
      }
      if (await User.exists({ email })) {
        return next(new ErrorHandler("That email is already in use", 409, { code: "DUPLICATE" }));
      }
      user.email = email;
    }

    await user.save();
    res.status(200).json({ success: true, user: safeUser(user) });
  })
);

// Update avatar
router.put(
  "/update-avatar",
  isAuthenticated,
  limits.upload,
  discardOnError,
  upload.single("image"),
  verifyImages,
  catchAsyncError(async (req, res, next) => {
    if (!req.file) return next(new ErrorHandler("Please choose an image", 400));
    const user = await User.findById(req.user._id);
    const previous = user.avatar;
    user.avatar = req.file.filename;
    await user.save();
    queueVariants([user.avatar]);
    removeAvatar(previous);
    res.status(200).json({ success: true, user: safeUser(user) });
  })
);

// Update password. Every other session is signed out; this one stays.
router.put(
  "/update-user-password",
  isAuthenticated,
  validate(schemas.updatePassword),
  limits.loginFailures,
  catchAsyncError(async (req, res, next) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.comparePassword(oldPassword))) {
      return next(new ErrorHandler("Your current password is incorrect", 400));
    }
    user.password = newPassword;
    await user.save();
    const signedOut = await session.revokeAll(KIND, user._id, req.sessionId);
    res.status(200).json({ success: true, message: "Password updated", signedOut });
  })
);

// Add or edit a saved address
router.put(
  "/update-user-addresses",
  isAuthenticated,
  validate(schemas.address),
  catchAsyncError(async (req, res, next) => {
    const { _id, ...data } = req.body;
    const user = await User.findById(req.user._id);

    if (_id) {
      const existing = user.addresses.id(_id);
      if (!existing) return next(new ErrorHandler("Address not found", 404));
      Object.assign(existing, data);
    } else {
      if (user.addresses.some((a) => a.addressType === data.addressType)) {
        return next(new ErrorHandler(`You already have a ${data.addressType} address`, 400));
      }
      if (user.addresses.length >= 10) return next(new ErrorHandler("You can save up to 10 addresses", 400));
      user.addresses.push(data);
    }
    await user.save();
    res.status(201).json({ success: true, user: safeUser(user) });
  })
);

// Delete a saved address
router.delete(
  "/delete-user-address/:id",
  isAuthenticated,
  validate(schemas.idParam),
  catchAsyncError(async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { addresses: { _id: req.params.id } } },
      { new: true }
    );
    res.status(200).json({ success: true, user: safeUser(user) });
  })
);

module.exports = router;
