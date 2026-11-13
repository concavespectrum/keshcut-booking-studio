// Shared, browser-safe helpers (also used by tests).
export function normalizePhone(input: string): string | null {
  let d = (input || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 13 && d.startsWith("977")) d = d.slice(3);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^9[678]\d{8}$/.test(d) ? d : null;
}
// Text and emoji only: strip control chars (keep newlines), cap length.
export function cleanMessage(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim();
  return t.length >= 1 && t.length <= 1000 ? t : null;
}

export function customServiceDetail(services: number[], value: unknown): { ok: true; detail: string } | { ok: false } {
  if (!services.includes(13)) return { ok: true, detail: "" };
  if (typeof value !== "string") return { ok: false };
  const detail = value.trim();
  return detail.length >= 1 && detail.length <= 500 ? { ok: true, detail } : { ok: false };
}
