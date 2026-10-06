// Writes AVIF/WebP size variants of public/banners/*.jpg next to the originals.
// Run after adding or replacing a banner:  node scripts/banners.cjs
// sharp is borrowed from the backend so the frontend doesn't carry a native dependency.
const fs = require("fs");
const path = require("path");
const sharp = require("../../backend/node_modules/sharp");

const DIR = path.join(__dirname, "..", "public", "banners");
const WIDTHS = [480, 800, 1200];

(async () => {
  for (const f of fs.readdirSync(DIR).filter((f) => /^[^.]+\.jpe?g$/i.test(f))) {
    const stem = f.replace(/\.jpe?g$/i, "");
    for (const w of WIDTHS) {
      for (const [fmt, opts] of [
        ["avif", { quality: 50, effort: 4 }],
        ["webp", { quality: 74 }],
      ]) {
        const out = path.join(DIR, `${stem}-w${w}.${fmt}`);
        await sharp(path.join(DIR, f)).resize({ width: w, withoutEnlargement: true })[fmt](opts).toFile(out);
        console.log(path.basename(out), Math.round(fs.statSync(out).size / 1024) + " KB");
      }
    }
  }
})();
