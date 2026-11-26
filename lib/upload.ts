/**
 * Strict checks for every picture the app accepts, run BEFORE the browser decodes it.
 * "accept=image/*" and the file name are only hints a person (or a script) can lie about, so we
 * look at the first bytes of the file itself, cap its size and its pixel count (a tiny file can
 * unpack into a huge image and freeze or crash the phone), and refuse SVG (it can carry script).
 */

/** Biggest picture we will even try to open. Phone photos are 2-8 MB; anything past this is not a photo. */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
/** Biggest picture by pixels (about 50 megapixels, larger than any phone camera). */
export const MAX_IMAGE_PIXELS = 50_000_000;
/** What we are willing to upload to the cloud (feedback screenshots), after shrinking. Matches the Supabase bucket limit. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export type ImageKind = "jpeg" | "png" | "webp" | "gif" | "heic";

const ascii = (b: Uint8Array, at: number, s: string) => s.length + at <= b.length && [...s].every((c, i) => b[at + i] === c.charCodeAt(0));

/** What the first bytes say the file really is, or null if it isn't a picture type we accept. */
export function sniffImage(b: Uint8Array): ImageKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, "PNG") && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return "webp";
  if (ascii(b, 0, "GIF87a") || ascii(b, 0, "GIF89a")) return "gif";
  if (ascii(b, 4, "ftyp") && ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].some((brand) => ascii(b, 8, brand))) return "heic";
  return null;
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);

/** Width and height read from the file header, without decoding it. null when it can't be read. */
export function imageSize(b: Uint8Array, kind: ImageKind): { w: number; h: number } | null {
  if (kind === "png" && b.length >= 24) return { w: u32be(b, 16), h: u32be(b, 20) };
  if (kind === "gif" && b.length >= 10) return { w: b[6] | (b[7] << 8), h: b[8] | (b[9] << 8) };
  if (kind === "webp" && b.length >= 30) {
    if (ascii(b, 12, "VP8X")) return { w: u24le(b, 24) + 1, h: u24le(b, 27) + 1 };
    if (ascii(b, 12, "VP8L")) {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (ascii(b, 12, "VP8 ")) return { w: (b[26] | (b[27] << 8)) & 0x3fff, h: (b[28] | (b[29] << 8)) & 0x3fff };
  }
  if (kind === "jpeg") {
    // Walk the segments until a "start of frame" marker, which holds the size.
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const m = b[i + 1];
      if (m === 0xff) {
        i++;
        continue;
      }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
        i += 2;
        continue;
      }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: u16be(b, i + 7), h: u16be(b, i + 5) };
      i += 2 + u16be(b, i + 2);
    }
  }
  return null;
}

/** Only the first 64 KB are read: enough for any header, and a huge file is never loaded into memory just to be checked. */
async function head(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, 65_536).arrayBuffer());
}

/**
 * Throws a friendly error unless `file` is a real, reasonably sized JPEG, PNG, WebP, GIF or HEIC picture.
 * Returns the detected kind.
 */
export async function assertImage(file: Blob, maxBytes = MAX_IMAGE_BYTES): Promise<ImageKind> {
  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > maxBytes) throw new Error(`That picture is too large (the limit is ${Math.round(maxBytes / 1048576)} MB).`);
  const bytes = await head(file);
  const kind = sniffImage(bytes);
  if (!kind) throw new Error("Please choose a photo or screenshot (JPEG, PNG, WebP or HEIC).");
  const size = imageSize(bytes, kind);
  if (size && (size.w < 1 || size.h < 1 || size.w * size.h > MAX_IMAGE_PIXELS)) throw new Error("That picture has too many pixels. Please choose a smaller one.");
  return kind;
}

/** Last check before anything leaves the device for the cloud: it must be a JPEG, and small. */
export async function assertUploadable(blob: Blob): Promise<void> {
  if (blob.size === 0 || blob.size > MAX_UPLOAD_BYTES) throw new Error("That picture is too large to send.");
  if (sniffImage(await head(blob)) !== "jpeg") throw new Error("Only JPEG pictures can be sent.");
}
