// Deployment URLs come from the request, so preview and custom domains stay valid.
export function crawlerResponse(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.pathname === "/robots.txt") {
    return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${url.origin}/sitemap.xml\n`, {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
    });
  }
  if (url.pathname === "/llms.txt") {
    return new Response(`# KeshCut Studio\n\n> Barbershop and barber academy in Saptagandagi, Bharatpur, Chitwan, Nepal. Open 9 AM to 7 PM. Customers book online at ${url.origin}/#book.\n\n## Services\n- Haircut & modern hairstyles, fades\n- Beard trimming & styling\n- Hair coloring & highlights, perming, dreadlocks (locs)\n- Hair washing, facial treatments, hair & scalp care, styling & blow dry, professional grooming\n- Barber Training & Academy Courses: professional-standard training that helps students find barber jobs in Nepal and abroad (UK, Canada and more)\n\n## Contact\n- Phone/WhatsApp: +977 9821433558\n- Instagram: https://www.instagram.com/keshcut_studio01\n- Facebook: https://www.facebook.com/share/1CHehRzfRm/\n`, {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
    });
  }
  if (url.pathname === "/sitemap.xml") {
    const origin = url.origin.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"><url><loc>${origin}/</loc><changefreq>weekly</changefreq><priority>1.0</priority>${["general/og-image.jpg", "gallery/studio-interior-stone-partition.jpg", "gallery/studio-interior-mask-wall.jpg", "gallery/studio-interior-night.jpg"].map((i) => `<image:image><image:loc>${origin}/images/${i}</image:loc></image:image>`).join("")}</url></urlset>`, {
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