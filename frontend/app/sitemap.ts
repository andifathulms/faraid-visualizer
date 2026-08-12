import type { MetadataRoute } from "next";
import { ROUTES, SITE_URL } from "@/lib/site";

// Generated from the same ROUTES list lib/site.ts uses for canonical URLs, so a new page
// cannot appear with a canonical tag but no sitemap entry.
//
// No lastModified: it would either be a build timestamp (which changes on every deploy
// and tells a crawler nothing true about the content) or a hand-maintained date that goes
// stale. Omitting it is more honest than either.

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    changeFrequency: "monthly" as const,
    priority: route === "/" ? 1 : 0.8,
  }));
}
