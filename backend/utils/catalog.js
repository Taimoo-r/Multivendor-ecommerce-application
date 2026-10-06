const fs = require("fs");
const path = require("path");
const { withPublicShop } = require("./publicShop");
const { UPLOADS, WIDTHS } = require("./images");

// Running / Upcoming / Ended is derived from the dates, not stored.
const presentEvent = (event) => {
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

// Delete an uploaded image and its responsive variants.
const removeImage = (filename) => {
  if (!filename || filename.includes("/") || filename.includes("\\")) return;
  const stem = filename.replace(/\.[a-z0-9]+$/i, "");
  const files = [filename, ...WIDTHS.flatMap((w) => [`${stem}-w${w}.avif`, `${stem}-w${w}.webp`])];
  files.forEach((f) => fs.unlink(path.join(UPLOADS, f), () => {}));
};

module.exports = { presentEvent, removeImage };
