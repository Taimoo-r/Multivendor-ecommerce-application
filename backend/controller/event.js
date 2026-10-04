const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const catchAsyncError = require("../middleware/catchAsyncErrors");
const { upload } = require("../multer");
const Event = require("../model/event");
const ErrorHandler = require("../utils/ErrorHandler");
const { isSeller } = require("../middleware/auth");
const { publicShop, withPublicShop } = require("../utils/publicShop");

const removeUpload = (filename) => {
  if (!filename) return;
  fs.unlink(path.join("uploads", filename), () => {});
};

// Running / Upcoming / Ended is derived from the dates, not stored.
const present = (event) => {
  const e = withPublicShop(event);
  const now = Date.now();
  e.status =
    now < new Date(e.start_Date).getTime()
      ? "Upcoming"
      : now > new Date(e.Finish_Date).getTime()
      ? "Ended"
      : "Running";
  return e;
};

// Create event (signed-in seller, for their own shop)
router.post(
  "/create-event",
  isSeller,
  upload.array("images", 6),
  catchAsyncError(async (req, res, next) => {
    const files = req.files || [];
    const b = req.body;
    const fail = (message) => {
      files.forEach((f) => removeUpload(f.filename));
      return next(new ErrorHandler(message, 400));
    };

    if (!b.name || !b.description || !b.category) {
      return fail("Please fill in the name, description and category");
    }
    if (files.length === 0) return fail("Please add at least one image");
    if (!(Number(b.discountPrice) > 0)) return fail("Please enter a valid price");
    if (!b.start_Date || !b.Finish_Date) return fail("Please choose the event dates");
    if (new Date(b.Finish_Date) <= new Date(b.start_Date)) {
      return fail("The event must end after it starts");
    }

    const event = await Event.create({
      name: b.name,
      description: b.description,
      category: b.category,
      tags: b.tags,
      start_Date: b.start_Date,
      Finish_Date: b.Finish_Date,
      originalPrice: b.originalPrice ? Number(b.originalPrice) : undefined,
      discountPrice: Number(b.discountPrice),
      stock: Number(b.stock) || 0,
      images: files.map((f) => f.filename),
      shopId: String(req.seller._id),
      shop: publicShop(req.seller),
    });

    res.status(201).json({ success: true, event: present(event) });
  })
);

// All events, soonest finishing first
router.get(
  "/get-all-events",
  catchAsyncError(async (req, res, next) => {
    const events = await Event.find().sort({ Finish_Date: 1 });
    res.status(200).json({ success: true, allEvents: events.map(present) });
  })
);

// Events of a shop
router.get(
  "/get-all-shop-events/:id",
  catchAsyncError(async (req, res, next) => {
    const events = await Event.find({ shopId: req.params.id }).sort({
      Finish_Date: 1,
    });
    res.status(200).json({ success: true, events: events.map(present) });
  })
);

// Delete an event of the signed-in shop
router.delete(
  "/delete-shop-event/:id",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return next(new ErrorHandler("Event not found", 404));
    }
    if (String(event.shopId) !== String(req.seller._id)) {
      return next(new ErrorHandler("You can only delete your own events", 403));
    }
    event.images.forEach(removeUpload);
    await Event.findByIdAndDelete(event._id);
    res.status(200).json({ success: true, message: "Event deleted" });
  })
);

module.exports = router;
