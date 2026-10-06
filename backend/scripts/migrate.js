// One-off, idempotent upgrade of an existing database to the current models.
//   cd backend && npm run migrate              (DB_URL from .env)
//   node scripts/migrate.js --db vendorzone_dev
//   node scripts/migrate.js --skip-images      (indexes and data only)
//
// 1. Fails if two shops share an email (the new unique index would not build).
// 2. Lowercases shop emails, backfills product discountPct and ratings.
// 3. Builds the indexes declared in the models and drops ones no longer declared.
// 4. Generates the AVIF/WebP size variants of every uploaded image.
// 5. Invalidates the catalogue cache.
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { useCustomDns } = require("../db/Database");
const Shop = require("../model/shop");
const User = require("../model/User");
const Product = require("../model/product");
const Event = require("../model/event");
const Order = require("../model/order");
const CouponCode = require("../model/couponCode");
const Session = require("../model/session");
const { makeVariants, isOriginalImage, UPLOADS } = require("../utils/images");
const cache = require("../lib/cache");
const { getRedis } = require("../lib/redis");

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function duplicateShopEmails() {
  return Shop.aggregate([
    { $group: { _id: { $toLower: { $trim: { input: "$email" } } }, ids: { $push: "$_id" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
}

async function main() {
  if (!process.env.DB_URL) throw new Error("DB_URL is not set (backend/.env)");
  useCustomDns();
  const dbName = arg("--db");
  await mongoose.connect(process.env.DB_URL, { autoIndex: false, ...(dbName ? { dbName } : {}) });
  console.log("Connected to", mongoose.connection.name);

  const dupes = await duplicateShopEmails();
  if (dupes.length) {
    console.error("These shop emails are used by more than one shop. Merge or rename them first:");
    dupes.forEach((d) => console.error(`  ${d._id}: ${d.ids.join(", ")}`));
    process.exit(2);
  }

  const lowered = await Shop.updateMany({}, [{ $set: { email: { $toLower: { $trim: { input: "$email" } } } } }]);
  console.log("Shop emails normalised:", lowered.modifiedCount);

  const pct = await Product.updateMany({}, [
    {
      $set: {
        discountPct: {
          $cond: [
            { $gt: [{ $ifNull: ["$originalPrice", 0] }, "$discountPrice"] },
            { $round: [{ $multiply: [{ $divide: [{ $subtract: ["$originalPrice", "$discountPrice"] }, "$originalPrice"] }, 100] }, 0] },
            0,
          ],
        },
        ratings: { $ifNull: ["$ratings", 0] },
      },
    },
  ]);
  console.log("Products backfilled:", pct.modifiedCount);

  for (const Model of [Shop, User, Product, Event, Order, CouponCode, Session]) {
    const dropped = await Model.syncIndexes();
    console.log(`Indexes ${Model.modelName}: in sync${dropped.length ? `, dropped ${dropped.join(", ")}` : ""}`);
  }

  if (!process.argv.includes("--skip-images") && fs.existsSync(UPLOADS)) {
    const files = fs.readdirSync(UPLOADS).filter(isOriginalImage);
    let made = 0;
    for (const [i, f] of files.entries()) {
      try {
        made += (await makeVariants(f)).length;
      } catch (e) {
        console.warn(`  skipped ${f}: ${e.message}`);
      }
      if ((i + 1) % 20 === 0) console.log(`  images ${i + 1}/${files.length}`);
    }
    console.log(`Image variants: ${made} written for ${files.length} images`);
  }

  getRedis();
  await new Promise((r) => setTimeout(r, 500)); // let Redis connect if it is there
  await cache.bump("p");
  await cache.del("shops:all", "events:all");
  console.log("Catalogue cache invalidated");

  await mongoose.disconnect();
  getRedis()?.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
