// One source for the strings that describe this site to anything outside it.
//
// The title, description and icons previously existed twice — once in layout.tsx's
// metadata and once, differently worded and in a different LANGUAGE, in
// public/manifest.webmanifest. A description that drifts from the page is worse than
// none, and these had already drifted: the metadata description was English while the
// manifest's was Indonesian, on a site whose primary language is Indonesian (PRD §7).
//
// Everything that names the site now reads from here: the document metadata, the Open
// Graph and Twitter cards, the web app manifest, and the sitemap.

/** Where the site is served from. Absolute URLs are required for OG/Twitter images. */
export const SITE_URL = "https://andifathulms.github.io/faraid-visualizer";

/** Path prefix for assets, matching next.config's basePath. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * Indonesian, because that is the language the page renders in by default and the one
 * `<html lang>` declares. A preview card in the wrong language is its own kind of drift.
 */
export const SITE = {
  name: "FaraidVisualizer",
  title: "FaraidVisualizer — kalkulator waris Islam yang menjelaskan alasannya",
  description:
    "Kalkulator waris Islam (faraid) yang menunjukkan alasan setiap bagian, beserta " +
    "rujukannya. Perhitungan berjalan sepenuhnya di perangkat Anda.",
  locale: "id_ID",
  lang: "id",
} as const;

/** The share image. The 512px brand icon — no asset invented, nothing generated. */
export const OG_IMAGE = {
  url: `${BASE_PATH}/brand/icon-512.png`,
  width: 512,
  height: 512,
  alt: SITE.name,
} as const;

/** Every indexable route, for the sitemap and for per-route canonical URLs. */
export const ROUTES = ["/", "/references/"] as const;
