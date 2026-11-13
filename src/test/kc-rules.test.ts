import { describe, expect, it } from "vitest";
import { cleanMessage, normalizePhone } from "@/lib/kc-shared";

describe("customer phone identity", () => {
  it("treats differently formatted copies of one number as the same customer", () => {
    for (const v of ["9769232638", "+977 976-923-2638", "00977 9769232638", "09769232638"]) expect(normalizePhone(v)).toBe("9769232638");
  });
  it("rejects numbers that are not Nepali mobiles", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("5551234567")).toBeNull();
  });
});

describe("chat messages", () => {
  it("allows text with emoji", () => expect(cleanMessage("Hi 👋")).toBe("Hi 👋"));
  it("rejects empty and over-1000-character messages", () => {
    expect(cleanMessage("   ")).toBeNull();
    expect(cleanMessage("a".repeat(1001))).toBeNull();
  });
});
