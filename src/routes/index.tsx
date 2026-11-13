import { createFileRoute } from "@tanstack/react-router";
import siteHtml from "../site/index.html?raw";

// The homepage is the original hand-built static site, served unchanged except for
// the domain placeholder and the public realtime config used by the chat widget.
export const Route = createFileRoute("/")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = new URL(request.url).origin;
        const cfg = `<script>window.KC_RT=${JSON.stringify({
          url: import.meta.env["VITE_SUPABASE_URL"],
          key: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
        })}</script>`;
        const html = siteHtml.replaceAll("https://YOUR-DOMAIN.com", origin).replace("</head>", cfg + "</head>");
        return new Response(html, {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" },
        });
      },
    },
  },
});
