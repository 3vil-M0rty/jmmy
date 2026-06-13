#!/usr/bin/env node
/**
 * optimize-image.mjs
 * ------------------
 * Turns one source image into the responsive WebP set the project expects:
 *   <outBase>-960.webp, <outBase>-1440.webp, <outBase>-2560.webp
 * at quality 72, never upscaling beyond the source's real width.
 *
 * Requires: npm i -D sharp
 *
 * Usage:
 *   node scripts/optimize-image.mjs <source> <outBase>
 *
 * Example (new DJ slide):
 *   node scripts/optimize-image.mjs ~/Downloads/newdj.jpg public/images/djs/newdj
 *   -> public/images/djs/newdj-960.webp  (+ -1440, -2560)
 *
 * Then reference it in code as "/images/djs/newdj" (no width, no extension);
 * the responsive() helper in AboutPage.jsx builds the srcset for you.
 */

import sharp from "sharp";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, basename } from "node:path";

const WIDTHS = [960, 1440, 2560];
const QUALITY = 72;

function fail(msg) {
  console.error(`\n  ✗ ${msg}\n`);
  console.error("  Usage: node scripts/optimize-image.mjs <source> <outBase>");
  console.error("  e.g.   node scripts/optimize-image.mjs ./newdj.jpg public/images/djs/newdj\n");
  process.exit(1);
}

const [src, outBase] = process.argv.slice(2);
if (!src || !outBase) fail("Missing arguments.");
if (!existsSync(src)) fail(`Source not found: ${src}`);
if (/-\d+\.webp$|\.webp$/i.test(outBase)) {
  fail("outBase must NOT include a width or extension. Use e.g. public/images/djs/newdj");
}

const outDir = dirname(outBase);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const kb = (p) => Math.round(statSync(p).size / 1024);

console.log(`\n  Optimizing ${basename(src)} (${kb(src)} KB) -> ${outBase}-{960,1440,2560}.webp\n`);

let totalOut = 0;
for (const w of WIDTHS) {
  const out = `${outBase}-${w}.webp`;
  await sharp(src)
    .resize({ width: w, withoutEnlargement: true }) // never blow a small image up
    .webp({ quality: QUALITY, effort: 6 })
    .toFile(out);
  const size = kb(out);
  totalOut += size;
  console.log(`    ✓ ${out}  ${size} KB`);
}

console.log(`\n  Done. ${kb(src)} KB source -> ${totalOut} KB across 3 variants.`);
console.log(`  Reference it as "${outBase.replace(/^public/, "")}" in your code.\n`);
