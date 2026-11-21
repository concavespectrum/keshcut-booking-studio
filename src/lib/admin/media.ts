// Browser-only helpers: shrink photos and grab a video poster before upload.
function toWebp(canvas: HTMLCanvasElement, q: number): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not process image"))), "image/webp", q));
}
function fit(w: number, h: number, max: number) {
  const s = Math.min(1, max / Math.max(w, h));
  return [Math.round(w * s), Math.round(h * s)] as const;
}
export async function compressImage(file: File, max = 1600, q = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const [w, h] = fit(bmp.width, bmp.height, max);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h); bmp.close();
  return toWebp(c, q);
}
export function videoPoster(file: File, max = 900): Promise<Blob> {
  return new Promise((res, rej) => {
    const v = document.createElement("video"); const url = URL.createObjectURL(file);
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    const done = (e?: Error) => { URL.revokeObjectURL(url); if (e) rej(e); };
    v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
    v.onseeked = async () => {
      try { const [w, h] = fit(v.videoWidth, v.videoHeight, max); const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d")!.drawImage(v, 0, 0, w, h); res(await toWebp(c, 0.75)); done(); } catch (e) { done(e as Error); }
    };
    v.onerror = () => done(new Error("Could not read video"));
    setTimeout(() => done(new Error("timeout")), 15000);
  });
}
