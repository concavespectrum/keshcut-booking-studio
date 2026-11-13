// Deployment URLs come from the request, so preview and custom domains stay valid.
export function crawlerResponse(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.pathname === "/robots.txt") {
    return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${url.origin}/sitemap.xml\n`, {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
    });
  }
  if (url.pathname === "/sitemap.xml") {
    const origin = url.origin.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>`, {
      headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
    });
  }
  return null;
}

export function secureResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  // Keep editor previews embeddable, but prevent embedding the private dashboard elsewhere.
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}