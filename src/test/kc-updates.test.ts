import { describe, expect, it } from "vitest";
import { bookingsCsv, csvCell } from "@/lib/admin/csv";
import { normalizePhone, customServiceDetail } from "@/lib/kc-shared";

describe("Others service rules for booking and edits", () => {
  it("requires details even when Others is combined with other services", () => {
    expect(customServiceDetail([1, 11, 12, 13], "  ")).toEqual({ ok: false });
    expect(customServiceDetail([13], undefined)).toEqual({ ok: false });
  });
  it("preserves the customer's custom request alongside selected services", () => {
    expect(customServiceDetail([11, 13], "  Wedding grooming ✂️  ")).toEqual({ ok: true, detail: "Wedding grooming ✂️" });
  });
  it("clears custom details when Others is removed", () => {
    expect(customServiceDetail([11, 12], "Previous request")).toEqual({ ok: true, detail: "" });
  });
});

describe("administrator contact numbers", () => {
  it("normalizes the owner's number without confusing it with the developer", () => {
    expect(normalizePhone("+977 9821433558")).toBe("9821433558");
    expect(normalizePhone("9821433558")).not.toBe(normalizePhone("9769232638"));
  });
});

describe("ticket exports", () => {
  it("includes ticket, customer, multiple services, custom details, Nepal times and status", () => {
    const csv = bookingsCsv([{ ticket_id: "KC-ABC234", starts_at: "2026-11-14T04:15:00Z", ends_at: "2026-11-14T05:15:00Z", status: "confirmed", custom_service: "Wedding grooming", customers: { name: "Test customer", phone: "9812345678" }, booking_services: [{ name: "Barber Training" }, { name: "Others" }] }]);
    for (const value of ["KC-ABC234", "Test customer", "9812345678", "Barber Training; Others", "Wedding grooming", "10:00:00", "11:00:00", "confirmed"]) expect(csv).toContain(csvCell(value));
  });
  it("escapes quotes, newlines and spreadsheet formulas", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(csvCell('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"');
    expect(csvCell(" +123")).toBe('"\' +123"');
  });
});