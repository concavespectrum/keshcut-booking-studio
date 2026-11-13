import { createFileRoute } from "@tanstack/react-router";
import { crawlerResponse } from "@/lib/deployment";

export const Route = createFileRoute("/sitemap.xml")({
  server: { handlers: { GET: ({ request }) => crawlerResponse(request) ?? new Response(null, { status: 404 }) } },
});