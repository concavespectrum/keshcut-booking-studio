export type ExportBooking = {
  ticket_id: string; starts_at: string; ends_at: string; status: string; custom_service: string | null;
  customers: { name: string; phone: string } | null;
  booking_services: { name: string }[];
};

// Quote every cell and neutralize spreadsheet formulas in customer-supplied data.
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function bookingsCsv(rows: ExportBooking[]): string {
  const date = (s: string) => new Date(s).toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" });
  const time = (s: string) => new Date(s).toLocaleTimeString("en-GB", { timeZone: "Asia/Kathmandu", hour12: false });
  return "\uFEFF" + [
    ["Ticket ID", "Customer", "Phone", "Services", "Other service details", "Date (Nepal)", "Start (Nepal)", "End (Nepal)", "Status"],
    ...rows.map(b => [b.ticket_id, b.customers?.name, b.customers?.phone, b.booking_services.map(s => s.name).join("; "), b.custom_service, date(b.starts_at), time(b.starts_at), time(b.ends_at), b.status]),
  ].map(row => row.map(csvCell).join(",")).join("\r\n");
}