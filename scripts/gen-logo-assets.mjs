// Regenerate the static logo assets from a transparent source logo.
//
//   node scripts/gen-logo-assets.mjs [path-to-transparent-logo.png]
//
// Produces, in public/:
//   logo-background-dark.png   — logo composited on solid black
//   logo-background-light.png  — logo composited on solid white
//   favicon.png                — 96x96 transparent favicon
//
// The source must be a transparent PNG (defaults to public/logo.png).
import { Jimp } from "jimp";
import { promises as fs } from "fs";
import path from "path";

const SRC = process.argv[2] || "public/logo.png";
const OUT = "public";

const logo = await Jimp.read(SRC);
const { width, height } = logo.bitmap;
console.log(`source: ${SRC} (${width}x${height})`);

async function onBackground(colorRGBA, name) {
  const bg = new Jimp({ width, height, color: colorRGBA });
  bg.composite(logo.clone(), 0, 0);
  const out = path.join(OUT, name);
  await fs.writeFile(out, await bg.getBuffer("image/png"));
  console.log(`wrote ${out}`);
}

await onBackground(0x000000ff, "logo-background-dark.png");
await onBackground(0xffffffff, "logo-background-light.png");

const fav = logo.clone().resize({ w: 96, h: 96 });
await fs.writeFile(path.join(OUT, "favicon.png"), await fav.getBuffer("image/png"));
console.log(`wrote ${path.join(OUT, "favicon.png")} (96x96 transparent)`);
