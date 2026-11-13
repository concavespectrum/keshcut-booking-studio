import { describe, expect, it } from "vitest";
import { crawlerResponse, secureResponse } from "@/lib/deployment";

describe("deployment URLs", () => {
  it("uses the actual deployed domain for the sitemap", async () => {
    const response = crawlerResponse(new Request("https://keshcut.example/sitemap.xml"));
    expect(await response?.text()).toContain("<loc>https://keshcut.example/</loc>");
  });
  it("excludes private management and API URLs from crawling", async () => {
    const text = await crawlerResponse(new Request("https://keshcut.example/robots.txt"))?.text();
    expect(text).toContain("Disallow: /admin\nDisallow: /api/");
    expect(text).toContain("Sitemap: https://keshcut.example/sitemap.xml");
  });
  it("leaves unrelated requests to the application", () => {
    expect(crawlerResponse(new Request("https://keshcut.example/admin"))).toBeNull();
  });
});

describe("response safety", () => {
  it("preserves private caching and session cookies while adding browser protections", async () => {
    const response = secureResponse(new Response("ok", { status: 201, headers: { "cache-control": "no-store", "set-cookie": "test=value; HttpOnly; Secure" } }));
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBe("test=value; HttpOnly; Secure");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe("ok");
  });
});