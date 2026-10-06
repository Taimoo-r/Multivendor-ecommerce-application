const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const ErrorHandler = require("./ErrorHandler");

sharp.cache(false); // a small server: do not hold decoded images in memory
sharp.concurrency(1);

const UPLOADS = path.join(__dirname, "..", "uploads");
const WIDTHS = [320, 640, 1000];
const VARIANT_RE = /-w\d+\.(webp|avif)$/;

// ---- file signatures ("magic bytes")
// The browser-supplied MIME type and file name can say anything; the first bytes cannot.
const SIGNATURES = [
  { ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "gif", test: (b) => ["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString("latin1")) },
  { ext: "webp", test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  { ext: "avif", test: (b) => b.subarray(4, 8).toString("latin1") === "ftyp" && ["avif", "avis"].includes(b.subarray(8, 12).toString("latin1")) },
];

async function detectImageType(file) {
  const fh = await fsp.open(file, "r");
  try {
    const buf = Buffer.alloc(16);
    await fh.read(buf, 0, 16, 0);
    return SIGNATURES.find((s) => s.test(buf))?.ext || null;
  } finally {
    await fh.close();
  }
}

const uploadedFiles = (req) => [...(req.file ? [req.file] : []), ...(req.files || [])];

// Runs after multer: rejects anything that is not really an image, and renames files
// whose extension does not match their content (so they are served with the right type).
const verifyImages = async (req, res, next) => {
  const files = uploadedFiles(req);
  try {
    for (const f of files) {
      const ext = await detectImageType(f.path);
      if (!ext) {
        await Promise.all(files.map((x) => fsp.unlink(x.path).catch(() => {})));
        return next(
          new ErrorHandler("That file is not a supported image (JPEG, PNG, WebP, AVIF or GIF)", 400, {
            code: "UPLOAD_REJECTED",
          })
        );
      }
      if (path.extname(f.filename).slice(1) !== ext) {
        const renamed = f.filename.replace(/\.[a-z0-9]+$/i, "") + "." + ext;
        await fsp.rename(f.path, path.join(path.dirname(f.path), renamed));
        f.filename = renamed;
        f.path = path.join(path.dirname(f.path), renamed);
      }
    }
    next();
  } catch (e) {
    next(e);
  }
};

// ---- responsive variants: <name>-w320.avif ... <name>-w1000.webp
const stem = (filename) => filename.replace(/\.[a-z0-9]+$/i, "");

async function makeVariants(filename, dir = UPLOADS) {
  const src = path.join(dir, filename);
  const made = [];
  for (const w of WIDTHS) {
    for (const [fmt, opts] of [
      ["avif", { quality: 50, effort: 2 }],
      ["webp", { quality: 72 }],
    ]) {
      const out = path.join(dir, `${stem(filename)}-w${w}.${fmt}`);
      if (fs.existsSync(out)) continue;
      await sharp(src, { animated: false })
        .rotate()
        .resize({ width: w, withoutEnlargement: true }) // always written, never upscaled
        [fmt](opts)
        .toFile(out);
      made.push(out);
    }
  }
  return made;
}

// Variants are made after the response, one image at a time, so uploads stay fast.
// Until they exist the browser falls back to the original (see Img in the frontend);
// `npm run migrate` regenerates anything missing after a restart.
const queue = [];
let running = false;
function queueVariants(filenames) {
  queue.push(...filenames);
  if (running) return;
  running = true;
  (async () => {
    while (queue.length) {
      const f = queue.shift();
      try {
        await makeVariants(f);
      } catch (e) {
        console.error("variant generation failed", f, e.message);
      }
    }
    running = false;
  })();
}

const isOriginalImage = (f) => /\.(jpe?g|png|gif|webp|avif)$/i.test(f) && !VARIANT_RE.test(f);

module.exports = {
  WIDTHS,
  detectImageType,
  verifyImages,
  makeVariants,
  queueVariants,
  uploadedFiles,
  isOriginalImage,
  UPLOADS,
};
