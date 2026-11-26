/**
 * Downloads a logo for every institution into public/logos/ and lists them in
 * lib/logos.generated.ts. Run with `npm run logos` (add `-- --force` to re-download all).
 *
 * Sources, best first:
 *   1. Google's site-icon service at 128px / 64px
 *   2. Icons the bank's own homepage declares (<link rel="icon">, apple-touch-icon)
 *   3. The site's /apple-touch-icon.png and /favicon.ico
 * Anything smaller than 48px (or Google's generic globe) is skipped; the app then shows a
 * monogram in the brand color instead.
 *
 * App icons added with `npm run logos:import` (<id>.app.png) are never replaced, even with --force.
 */
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { INSTITUTIONS } from "../lib/institutions";

const OUT = join(process.cwd(), "public", "logos");
mkdirSync(OUT, { recursive: true });
const force = process.argv.includes("--force");
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
const MIN = 48;

type Found = { buf: Buffer; ext: "png" | "ico" | "svg"; size: number };

/** Works out the type and pixel size of an image buffer. */
function inspect(buf: Buffer): Found | null {
  if (buf.length > 24 && buf.subarray(1, 4).toString() === "PNG") return { buf, ext: "png", size: buf.readUInt32BE(16) };
  if (buf.length > 6 && buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1) {
    // .ico: the biggest image in the directory (0 means 256)
    const n = buf.readUInt16LE(4);
    let max = 0;
    for (let i = 0; i < n && 6 + i * 16 < buf.length; i++) max = Math.max(max, buf[6 + i * 16] || 256);
    return { buf, ext: "ico", size: max };
  }
  const head = buf.subarray(0, 300).toString("utf8");
  if (/<svg[\s>]/i.test(head) || (head.startsWith("<?xml") && /<svg/i.test(buf.toString("utf8", 0, 2000)))) return { buf, ext: "svg", size: 512 };
  return null;
}

async function get(url: string): Promise<Found | null> {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000), redirect: "follow" });
    if (!res.ok) return null;
    return inspect(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

/** Icon URLs the homepage declares, largest first. */
async function declaredIcons(domain: string): Promise<string[]> {
  for (const base of [`https://www.${domain}/`, `https://${domain}/`]) {
    try {
      const res = await fetch(base, { headers: UA, signal: AbortSignal.timeout(12000), redirect: "follow" });
      if (!res.ok) continue;
      const html = await res.text();
      const found: { url: string; size: number }[] = [];
      for (const m of html.matchAll(/<link[^>]+>/gi)) {
        const tag = m[0];
        if (!/rel=["'][^"']*(icon|apple-touch)/i.test(tag)) continue;
        const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
        if (!href) continue;
        const size = parseInt(tag.match(/sizes=["'](\d+)/i)?.[1] ?? "0", 10);
        found.push({ url: new URL(href, res.url).href, size: /apple-touch/i.test(tag) && !size ? 180 : size });
      }
      const origin = new URL(res.url).origin;
      found.push({ url: `${origin}/apple-touch-icon.png`, size: 180 }, { url: `${origin}/favicon.ico`, size: 0 });
      return found.sort((a, b) => b.size - a.size).map((f) => f.url);
    } catch {
      /* try the next base */
    }
  }
  return [];
}

async function findLogo(domain: string): Promise<Found | null> {
  for (const [sz, min] of [[128, MIN], [64, MIN]] as const) {
    const f = await get(`https://www.google.com/s2/favicons?domain=${domain}&sz=${sz}`);
    if (f && f.size >= min) return f;
  }
  let best: Found | null = null;
  for (const url of await declaredIcons(domain)) {
    const f = await get(url);
    if (f && f.size >= MIN && (!best || f.size > best.size)) best = f;
    if (best && best.size >= 128) break;
  }
  return best;
}

async function main() {
  const jobs = new Map<string, string>();
  for (const i of INSTITUTIONS) if (!jobs.has(i.logo)) jobs.set(i.logo, i.domain);
  const idOf = (f: string) => f.replace(/(\.app)?\.(png|ico|svg)$/, "");
  const existing = new Map(readdirSync(OUT).map((f) => [idOf(f), f]));

  let ok = 0;
  const missing: string[] = [];
  for (const [logo, domain] of jobs) {
    const have = existing.get(logo);
    if (have && (!force || have.includes(".app."))) {
      ok++;
      continue;
    }
    const f = await findLogo(domain);
    if (!f) {
      missing.push(`${logo} (${domain})`);
      continue;
    }
    const old = existing.get(logo);
    if (old) unlinkSync(join(OUT, old));
    writeFileSync(join(OUT, `${logo}.${f.ext}`), f.buf);
    ok++;
    console.log(`  ${logo}: ${f.ext} ${f.size}px`);
  }

  // Remove logos for institutions that no longer exist (e.g. renamed ones).
  for (const f of readdirSync(OUT)) {
    if (/\.(png|ico|svg)$/.test(f) && !jobs.has(idOf(f))) unlinkSync(join(OUT, f));
  }

  const files = Object.fromEntries(
    readdirSync(OUT)
      .filter((f) => /\.(png|ico|svg)$/.test(f))
      .map((f) => [idOf(f), f])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(
    join(process.cwd(), "lib", "logos.generated.ts"),
    `// Generated by \`npm run logos\` / \`npm run logos:import\`. Maps logo id -> file in public/logos.\n` +
      `// Files named <id>.app.png are full-bleed app icons.\nexport const LOGOS: Record<string, string> = ${JSON.stringify(files, null, 2)};\n`,
  );
  console.log(`Saved ${ok}/${jobs.size} logos to public/logos`);
  if (missing.length) console.log(`No usable logo (monogram will be shown): ${missing.join(", ")}`);
}

void main();

