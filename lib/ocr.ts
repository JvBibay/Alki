/**
 * On-device text recognition for receipts, using Tesseract.js (open source, runs in a worker).
 * All engine files are served by Kwenta itself from /public/ocr, so nothing is sent to other
 * sites. The first scan downloads ~7 MB; after that the service worker keeps it for offline use.
 */

import { assertImage } from "./upload";

export async function readReceiptText(image: Blob, onProgress?: (p: number, step: string) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  onProgress?.(0, "Getting ready");
  const worker = await createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/",
    langPath: "/ocr/lang",
    gzip: true,
    workerBlobURL: false, // load the worker as a normal file (keeps the security policy strict)
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(m.progress, "Reading receipt");
      else if (/loading|initializ/i.test(m.status)) onProgress?.(0, m.status.includes("language") ? "Loading reader (first time only)" : "Getting ready");
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text ?? "";
  } finally {
    await worker.terminate();
  }
}

/** A larger, high-contrast copy of the photo just for reading text (not saved). */
export async function prepareForOcr(file: Blob, max = 1800): Promise<Blob> {
  await assertImage(file);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Couldn’t read that image."));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const g = c.getContext("2d")!;
    // Grayscale + extra contrast helps with faded thermal receipts.
    g.filter = "grayscale(1) contrast(1.4)";
    g.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn’t prepare the image."))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}
