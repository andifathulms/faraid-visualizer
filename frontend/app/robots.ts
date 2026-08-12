import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// There was no robots.txt and no sitemap. The content was reachable — the HTML is fully
// prerendered and .nojekyll is in place — but nothing pointed a crawler at either URL.
//
// Generated rather than written by hand so the sitemap host and this file cannot disagree
// about where the site lives.

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The Python sources and the WebAssembly runtime are ~13 MB of build output with
      // no reader-facing content. Crawling them costs the crawler and gains nobody.
      disallow: ["/py/", "/pyodide/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
