const express = require("express");
const router = express.Router();
const catchAsyncError = require("../middleware/catchAsyncErrors");
const validate = require("../middleware/validate");
const { limits } = require("../middleware/rateLimit");
const schemas = require("../validation/schemas").event;
const { upload } = require("../multer");
const Event = require("../model/event");
const ErrorHandler = require("../utils/ErrorHandler");
const { isSeller } = require("../middleware/auth");
const { publicShop } = require("../utils/publicShop");
const { verifyImages, queueVariants } = require("../utils/images");
const { presentEvent, removeImage } = require("../utils/catalog");
const { discardOnError } = require("./product");
const cache = require("../lib/cache");

const PUBLIC = "public, max-age=0, s-maxage=30, stale-while-revalidate=60";
const LIST = { reviews: 0, description: 0 };

// The cache holds raw events; status is computed on every response so an event
// never shows "Upcoming" after it started just because the list was cached.
const sendEvents = (res, result, field) => {
  res.set("Cache-Control", PUBLIC);
  cache.sendCached(res, result, (events) => ({ success: true, [field]: events.map(presentEvent) }));
};

const invalidateEvents = (shopId, eventId) =>
  cache.del("events:all", `events:shop:${shopId}`, `p:item:${eventId}`);

// Create event (signed-in seller, for their own shop)
router.post(
  "/create-event",
  isSeller,
  limits.sellerWrite,
  limits.upload,
  discardOnError,
  upload.array("images", 6),
  verifyImages,
  validate(schemas.create),
  catchAsyncError(async (req, res, next) => {
    const files = req.files || [];
    if (files.length === 0) {
      return next(new ErrorHandler("Please add at least one image", 400, { code: "VALIDATION_ERROR" }));
    }
    const event = await Event.create({
      ...req.body,
      images: files.map((f) => f.filename),
      shopId: String(req.seller._id),
      shop: publicShop(req.seller),
    });
    queueVariants(event.images);
    await invalidateEvents(event.shopId, event._id);
    res.status(201).json({ success: true, event: presentEvent(event) });
  })
);

// All events that haven't ended, soonest finishing first
router.get(
  "/get-all-events",
  limits.browse,
  catchAsyncError(async (req, res) => {
    const result = await cache.cached("events:all", 30, () =>
      Event.find({ Finish_Date: { $gt: new Date(Date.now() - 7 * 864e5) } }, LIST)
        .sort({ Finish_Date: 1 })
        .limit(100)
        .lean()
    );
    sendEvents(res, result, "allEvents");
  })
);

// Events of a shop
router.get(
  "/get-all-shop-events/:id",
  limits.browse,
  validate(schemas.idParam),
  catchAsyncError(async (req, res) => {
    const { id } = req.params;
    const result = await cache.cached(`events:shop:${id}`, 30, () =>
      Event.find({ shopId: id }, LIST).sort({ Finish_Date: 1 }).lean()
    );
    sendEvents(res, result, "events");
  })
);

// Delete an event of the signed-in shop
router.delete(
  "/delete-shop-event/:id",
  isSeller,
  limits.sellerWrite,
  validate(schemas.idParam),
  catchAsyncError(async (req, res, next) => {
    const event = await Event.findById(req.params.id);
    if (!event) return next(new ErrorHandler("Event not found", 404));
    if (String(event.shopId) !== String(req.seller._id)) {
      return next(new ErrorHandler("You can only delete your own events", 403));
    }
    await Event.findByIdAndDelete(event._id);
    event.images.forEach(removeImage);
    await invalidateEvents(event.shopId, event._id);
    res.status(200).json({ success: true, message: "Event deleted" });
  })
);

module.exports = router;
module.exports.invalidateEvents = invalidateEvents;
