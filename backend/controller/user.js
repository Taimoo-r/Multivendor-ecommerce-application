const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const User = require("../model/User");
const { upload } = require("../multer");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncError = require("../middleware/catchAsyncErrors");
const sendMail = require("../utils/sendMail");
const sendToken = require("../utils/jwtToken");
const { isAuthenticated } = require("../middleware/auth");
const passwordResetHandlers = require("../utils/passwordReset");

const DEFAULT_AVATAR = "default-avatar.jpg";
const MIN_PASSWORD_LENGTH = 6;

const removeUpload = (filename) => {
  if (!filename || filename === DEFAULT_AVATAR) return;
  fs.unlink(path.join("uploads", filename), () => {});
};

// Create activation Token. The password is hashed first so the emailed link
// never contains it in readable form.
const createActivationToken = (user) =>
  jwt.sign(user, process.env.ACTIVATION_SECRET, {
    expiresIn: process.env.ACTIVATION_EXPIRES,
  });

// Create user (sends an activation email)
router.post(
  "/create-user",
  upload.single("file"),
  catchAsyncError(async (req, res, next) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      removeUpload(req.file && req.file.filename);
      return next(new ErrorHandler("Please fill in all the fields", 400));
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      removeUpload(req.file && req.file.filename);
      return next(
        new ErrorHandler(
          `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          400
        )
      );
    }

    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists) {
      removeUpload(req.file && req.file.filename);
      return next(new ErrorHandler("An account with this email already exists", 400));
    }

    const user = {
      name,
      email: String(email).toLowerCase(),
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
    } catch (error) {
      removeUpload(req.file && req.file.filename);
      return next(new ErrorHandler("Could not send the activation email", 500));
    }
    res.status(201).json({
      success: true,
      message: `Please check your email (${user.email}) to activate your account`,
    });
  })
);

// Activate user
router.post(
  "/activation",
  catchAsyncError(async (req, res, next) => {
    const { activation_token } = req.body;
    const newUser = jwt.verify(activation_token, process.env.ACTIVATION_SECRET);
    if (!newUser) {
      return next(new ErrorHandler("Invalid token", 400));
    }

    const { name, email, password, avatar } = newUser;
    if (await User.findOne({ email })) {
      return next(new ErrorHandler("This account is already activated", 400));
    }

    const user = new User({ name, email, password, avatar });
    user.$locals.passwordHashed = true; // already hashed in create-user
    await user.save();

    sendToken(user, 201, res);
  })
);

// Forgot / reset password
const userReset = passwordResetHandlers(User, { resetPath: "/reset-password" });
router.post("/forgot-password", catchAsyncError(userReset.forgot));
router.post("/reset-password/:token", catchAsyncError(userReset.reset));

// Login user
router.post(
  "/login-user",
  catchAsyncError(async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new ErrorHandler("Please provide all fields!", 400));
    }

    const user = await User.findOne({ email: String(email).toLowerCase() }).select(
      "+password"
    );
    if (!user || !(await user.comparePassword(password))) {
      return next(new ErrorHandler("Incorrect email or password", 400));
    }

    sendToken(user, 201, res);
  })
);

// Load user
router.get(
  "/load-user",
  isAuthenticated,
  catchAsyncError(async (req, res, next) => {
    res.status(200).json({ success: true, user: req.user });
  })
);

// Logout user
router.get(
  "/logout",
  catchAsyncError(async (req, res, next) => {
    res.clearCookie("token", { httpOnly: true });
    res.status(200).json({ success: true, message: "Logged out" });
  })
);

// Update profile details. Changing the email requires the current password.
router.put(
  "/update-user-info",
  isAuthenticated,
  catchAsyncError(async (req, res, next) => {
    const { name, email, phoneNumber, password } = req.body;
    const user = await User.findById(req.user.id).select("+password");

    if (name !== undefined) {
      if (!String(name).trim()) {
        return next(new ErrorHandler("Name can't be empty", 400));
      }
      user.name = String(name).trim();
    }

    if (phoneNumber !== undefined && phoneNumber !== "") {
      const digits = String(phoneNumber).replace(/[\s()+-]/g, "");
      if (!/^\d{7,15}$/.test(digits)) {
        return next(new ErrorHandler("Please enter a valid phone number", 400));
      }
      user.phoneNumber = Number(digits);
    } else if (phoneNumber === "") {
      user.phoneNumber = undefined;
    }

    if (email !== undefined && String(email).toLowerCase() !== user.email) {
      if (!password || !(await user.comparePassword(password))) {
        return next(
          new ErrorHandler("Enter your current password to change your email", 400)
        );
      }
      const taken = await User.findOne({ email: String(email).toLowerCase() });
      if (taken) {
        return next(new ErrorHandler("That email is already in use", 400));
      }
      user.email = String(email).toLowerCase();
    }

    await user.save();
    user.password = undefined;
    res.status(200).json({ success: true, user });
  })
);

// Update avatar
router.put(
  "/update-avatar",
  isAuthenticated,
  upload.single("image"),
  catchAsyncError(async (req, res, next) => {
    if (!req.file) {
      return next(new ErrorHandler("Please choose an image", 400));
    }
    const user = await User.findById(req.user.id);
    const previous = user.avatar;
    user.avatar = req.file.filename;
    await user.save();
    removeUpload(previous);
    res.status(200).json({ success: true, user });
  })
);

// Update password
router.put(
  "/update-user-password",
  isAuthenticated,
  catchAsyncError(async (req, res, next) => {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findById(req.user.id).select("+password");

    if (!oldPassword || !(await user.comparePassword(oldPassword))) {
      return next(new ErrorHandler("Your current password is incorrect", 400));
    }
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      return next(
        new ErrorHandler(
          `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          400
        )
      );
    }
    if (newPassword !== confirmPassword) {
      return next(new ErrorHandler("The new passwords don't match", 400));
    }

    user.password = newPassword;
    await user.save();
    res.status(200).json({ success: true, message: "Password updated" });
  })
);

// Add or edit a saved address
router.put(
  "/update-user-addresses",
  isAuthenticated,
  catchAsyncError(async (req, res, next) => {
    const { _id, country, city, address1, address2, zipCode, addressType } =
      req.body;
    if (!country || !city || !address1 || !zipCode || !addressType) {
      return next(new ErrorHandler("Please fill in all the address fields", 400));
    }

    const user = await User.findById(req.user.id);
    const data = { country, city, address1, address2, zipCode, addressType };

    if (_id) {
      const existing = user.addresses.id(_id);
      if (!existing) return next(new ErrorHandler("Address not found", 404));
      Object.assign(existing, data);
    } else {
      if (user.addresses.some((a) => a.addressType === addressType)) {
        return next(
          new ErrorHandler(`You already have a ${addressType} address`, 400)
        );
      }
      user.addresses.push(data);
    }
    await user.save();

    res.status(201).json({ success: true, user });
  })
);

// Delete a saved address
router.delete(
  "/delete-user-address/:id",
  isAuthenticated,
  catchAsyncError(async (req, res, next) => {
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { addresses: { _id: req.params.id } } }
    );
    const user = await User.findById(req.user._id);
    res.status(200).json({ success: true, user });
  })
);

module.exports = router;
