// Puts Kwenta's icon into the Android project (android-app/android), replacing the default Capacitor icon.
// Run by scripts/build-apk.ps1 after the Android project exists. Needs `sharp` (already installed with Next.js).
import sharp from "sharp";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SRC = "public/icons/icon-512.png";
const RES = join("android-app", "android", "app", "src", "main", "res");
const BG = "#2f7a4d"; // the icon's own green, used behind the adaptive icon
const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

if (!existsSync(RES)) throw new Error("Android project not found: " + RES);

for (const [d, m] of Object.entries(DENSITY)) {
  const dir = join(RES, `mipmap-${d}`);
  const legacy = Math.round(48 * m);
  const full = await sharp(SRC).resize(legacy, legacy).png().toBuffer();
  writeFileSync(join(dir, "ic_launcher.png"), full);
  // round version: same picture cut to a circle
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`);
  writeFileSync(join(dir, "ic_launcher_round.png"), await sharp(full).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer());
  // adaptive foreground: 108dp canvas, picture kept inside the 66% safe zone so no phone shape crops it
  const canvas = Math.round(108 * m), art = Math.round(canvas * 0.66);
  const artBuf = await sharp(SRC).resize(art, art).png().toBuffer();
  writeFileSync(
    join(dir, "ic_launcher_foreground.png"),
    await sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: artBuf, gravity: "center" }]).png().toBuffer(),
  );
}

const colors = join(RES, "values", "ic_launcher_background.xml");
writeFileSync(colors, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);
console.log("Kwenta icon written to the Android project.");
