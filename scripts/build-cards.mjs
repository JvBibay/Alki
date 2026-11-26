// Builds the credit card pictures from folders of card images (see scripts/cards.catalog.mjs).
//
// Usage: npm run cards -- <folder> [<folder> …] [--preview <dir>] [--only <id,id,…>]
//
// For each card in the catalog: finds the card in its picture (drops the page background and
// shadow), resizes it to a standard card shape, rounds the corners, and erases the sample
// cardholder name and card number by filling those areas in from the pixels around them.
// Writes public/cards/<id>.webp and lib/cards.generated.ts.
// A card whose source picture isn't in the given folders keeps its already-built picture, so
// old source folders can be deleted. Pictures of cards no longer in the catalog are removed.
// --preview writes gridded contact sheets to <dir> instead, to check and tune the erase areas.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { CARDS } from "./cards.catalog.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const preview = flag("--preview");
const only = flag("--only")?.split(",");
const folders = args.filter((a, i) => !a.startsWith("--") && !["--preview", "--only"].includes(args[i - 1]));
if (!folders.length || folders.some((f) => !existsSync(f))) {
  console.error("Usage: npm run cards -- <folder> [<folder> …] [--preview <dir>] [--only <id,id,…>]");
  process.exit(1);
}

const LONG = 480;
const SHORT = Math.round(LONG / 1.586); // ID-1 card ratio
/** Source pictures from every folder, as full paths. */
const files = folders.flatMap((d) => readdirSync(d).map((f) => join(d, f)));

/** Bounding box of the card: columns/rows where enough pixels differ clearly from the background. */
function cardBox(data, w, h, ch, tol = 40) {
  const px = (x, y) => (y * w + x) * ch;
  const corners = [px(1, 1), px(w - 2, 1), px(1, h - 2), px(w - 2, h - 2)].map((i) => [data[i], data[i + 1], data[i + 2], ch === 4 ? data[i + 3] : 255]);
  const bg = [0, 1, 2, 3].map((k) => corners.map((c) => c[k]).sort((a, b) => a - b)[1]);
  const isCard = (i) => {
    const a = ch === 4 ? data[i + 3] : 255;
    if (bg[3] < 128) return a > 128; // transparent page: anything opaque is card
    return Math.max(Math.abs(data[i] - bg[0]), Math.abs(data[i + 1] - bg[1]), Math.abs(data[i + 2] - bg[2])) > tol;
  };
  const cols = new Array(w).fill(0);
  const rows = new Array(h).fill(0);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (isCard(px(x, y))) {
        cols[x]++;
        rows[y]++;
      }
  const span = (arr, total) => {
    const need = total * 0.3;
    let a = arr.findIndex((n) => n > need);
    let b = arr.length - 1 - [...arr].reverse().findIndex((n) => n > need);
    return [a, b];
  };
  const [x0, x1] = span(cols, h);
  const [y0, y1] = span(rows, w);
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/**
 * Fills a rectangle by blending the pixel bands just outside it (vertical, or horizontal with "h"),
 * or with "c" copies the same-size patch `dy` percent higher (for even, repeating patterns).
 */
function erase(data, w, h, [px0, py0, px1, py1, dir, dy]) {
  const x0 = Math.max(0, Math.round((px0 / 100) * w));
  const x1 = Math.min(w - 1, Math.round((px1 / 100) * w));
  const y0 = Math.max(0, Math.round((py0 / 100) * h));
  const y1 = Math.min(h - 1, Math.round((py1 / 100) * h));
  const at = (x, y) => (y * w + x) * 4;
  const band = (xs, ys) => {
    const s = [0, 0, 0, 0];
    let n = 0;
    for (const x of xs) for (const y of ys) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = at(x, y);
      for (let k = 0; k < 4; k++) s[k] += data[i + k];
      n++;
    }
    return s.map((v) => v / Math.max(1, n));
  };
  const r = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  if (dir === "c") {
    // Copy a clean patch from above, feathering its edges into what's around it.
    const off = Math.round((dy / 100) * h);
    const feather = 6;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const edge = Math.min(x - x0, x1 - x, y - y0, y1 - y);
        const t = Math.min(1, (edge + 1) / feather);
        const i = at(x, y);
        const j = at(x, y - off);
        for (let k = 0; k < 4; k++) data[i + k] = data[i + k] * (1 - t) + data[j + k] * t;
      }
    return;
  }
  if (dir === "h") {
    for (let y = y0; y <= y1; y++) {
      const L = band(r(x0 - 4, x0 - 1), r(y - 1, y + 1));
      const R = band(r(x1 + 1, x1 + 4), r(y - 1, y + 1));
      for (let x = x0; x <= x1; x++) {
        const t = (x - x0) / Math.max(1, x1 - x0);
        const i = at(x, y);
        for (let k = 0; k < 4; k++) data[i + k] = L[k] * (1 - t) + R[k] * t;
      }
    }
  } else {
    for (let x = x0; x <= x1; x++) {
      const T = band(r(x - 1, x + 1), r(y0 - 4, y0 - 1));
      const B = band(r(x - 1, x + 1), r(y1 + 1, y1 + 4));
      for (let y = y0; y <= y1; y++) {
        const t = (y - y0) / Math.max(1, y1 - y0);
        const i = at(x, y);
        for (let k = 0; k < 4; k++) data[i + k] = T[k] * (1 - t) + B[k] * t;
      }
    }
  }
  // Soften the fill (3x3 box blur; more passes for taller areas) and add a little grain so it doesn't look flat.
  const passes = 2 + Math.floor((y1 - y0) / 20);
  for (let pass = 0; pass < passes; pass++) {
    const copy = Buffer.from(data);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const s = [0, 0, 0];
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = at(xx, yy);
            s[0] += copy[j]; s[1] += copy[j + 1]; s[2] += copy[j + 2];
            n++;
          }
        const i = at(x, y);
        for (let k = 0; k < 3; k++) data[i + k] = s[k] / n;
      }
  }
  let seed = x0 * 7919 + y0 * 104729;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = at(x, y);
      const g = rand() * 5;
      for (let k = 0; k < 3; k++) data[i + k] = Math.max(0, Math.min(255, data[i + k] + g));
    }
}

const roundMask = (w, h) =>
  Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${Math.round(Math.min(w, h) * 0.075)}" fill="#fff"/></svg>`);

const OUT = join("public", "cards");
if (!preview) {
  // Only remove card pictures this script made earlier (public/cards/*.webp), nothing else.
  // Only remove pictures of cards that are no longer in the catalog.
  mkdirSync(OUT, { recursive: true });
  const ids = new Set(CARDS.map((c) => c.id));
  for (const f of readdirSync(OUT)) if (f.endsWith(".webp") && !ids.has(f.slice(0, -5))) rmSync(join(OUT, f));
}
const made = [];
const kept = [];
const previews = [];
for (const c of CARDS) {
  if (only && !only.includes(c.id)) {
    if (!preview && existsSync(join(OUT, `${c.id}.webp`))) kept.push(c);
    continue;
  }
  const file = files.find((f) => f.replace(/\\/g, "/").split("/").pop().includes(c.src));
  if (!file) {
    if (!preview && existsSync(join(OUT, `${c.id}.webp`))) kept.push(c);
    else console.warn(`  ! no source or picture for ${c.id} (${c.src})`);
    continue;
  }
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // `full`: the picture is the card edge to edge (no page around it).
  const box = c.full ? { left: 0, top: 0, width: info.width, height: info.height } : cardBox(data, info.width, info.height, 4, c.tol);
  const [w, h] = c.v ? [SHORT, LONG] : [LONG, SHORT];
  // Shave 1% off each side so no background or shadow edge is left.
  const inset = { x: Math.round(box.width * 0.01), y: Math.round(box.height * 0.01) };
  // Optional extra trim [top, right, bottom, left] in percent, for pictures with a frame around the card.
  const [tt, tr, tb, tl] = (c.trim ?? [0, 0, 0, 0]).map((p, k) => Math.round(((k % 2 ? box.width : box.height) * p) / 100));
  const crop = { left: box.left + inset.x + tl, top: box.top + inset.y + tt, width: box.width - inset.x * 2 - tl - tr, height: box.height - inset.y * 2 - tt - tb };
  const resized = await sharp(file).ensureAlpha().extract(crop).resize(w, h, { fit: "fill" }).raw().toBuffer();
  for (const rect of c.erase) erase(resized, w, h, rect);
  const img = sharp(resized, { raw: { width: w, height: h, channels: 4 } }).composite([{ input: roundMask(w, h), blend: "dest-in" }]);
  if (preview) previews.push({ c, png: await img.png().toBuffer(), w, h });
  else {
    await img.webp({ quality: 84, alphaQuality: 90, effort: 6 }).toFile(join(OUT, `${c.id}.webp`));
    made.push(c);
  }
}

if (preview) {
  mkdirSync(preview, { recursive: true });
  // 3 per row, 10% grid lines, card id on top.
  const CW = 420, per = 12;
  for (let p = 0; p * per < previews.length; p++) {
    const page = previews.slice(p * per, (p + 1) * per);
    const comps = [];
    const cellH = 440;
    for (let j = 0; j < page.length; j++) {
      const { c, png, w, h } = page[j];
      const scale = Math.min((CW - 20) / w, (cellH - 50) / h);
      const sw = Math.round(w * scale), sh = Math.round(h * scale);
      const x = (j % 3) * CW + 10, y = Math.floor(j / 3) * cellH + 34;
      comps.push({ input: await sharp(png).resize(sw, sh).png().toBuffer(), left: x, top: y });
      let lines = "";
      for (let k = 1; k < 10; k++) {
        const gx = (sw * k) / 10, gy = (sh * k) / 10;
        const col = k === 5 ? "#ff00ff" : "#00e5ff";
        lines += `<line x1="${gx}" y1="0" x2="${gx}" y2="${sh}" stroke="${col}" stroke-width="1" opacity=".55"/><line x1="0" y1="${gy}" x2="${sw}" y2="${gy}" stroke="${col}" stroke-width="1" opacity=".55"/>`;
        lines += `<text x="${gx + 1}" y="9" font-size="9" fill="#ff0" font-family="Arial">${k * 10}</text><text x="1" y="${gy - 1}" font-size="9" fill="#ff0" font-family="Arial">${k * 10}</text>`;
      }
      comps.push({ input: Buffer.from(`<svg width="${sw}" height="${sh}">${lines}</svg>`), left: x, top: y });
      comps.push({ input: Buffer.from(`<svg width="${CW - 10}" height="26"><rect width="100%" height="26" fill="#111"/><text x="6" y="18" font-family="Arial" font-size="15" font-weight="bold" fill="#ffd400">${c.id}</text></svg>`), left: x - 5, top: y - 30 });
    }
    const rows = Math.ceil(page.length / 3);
    await sharp({ create: { width: CW * 3, height: rows * cellH, channels: 3, background: "#cfd4da" } }).composite(comps).png().toFile(join(preview, `cards-${p}.png`));
  }
  console.log(`Preview: ${previews.length} cards in ${preview}`);
} else {
  // Catalog order, built now or kept from before.
  const have = new Set([...made, ...kept].map((c) => c.id));
  const list = CARDS.filter((c) => have.has(c.id)).map(({ id, bank, name, net, v }) => ({ id, bank, name, net, ...(v ? { v: true } : {}) }));
  writeFileSync(
    join("lib", "cards.generated.ts"),
    `// Generated by \`npm run cards\` (scripts/build-cards.mjs). Do not edit by hand.\n` +
      `// Credit card pictures in public/cards/<id>.webp, sample names and numbers erased.\n` +
      `export interface CardArt { id: string; bank: string; name: string; net: "visa" | "mastercard" | "jcb"; v?: boolean }\n` +
      `export const CARD_ARTS: CardArt[] = ${JSON.stringify(list, null, 2)};\n`,
  );
  console.log(`Built ${made.length} card pictures, kept ${kept.length} from before (${list.length} in public/cards)`);
}
