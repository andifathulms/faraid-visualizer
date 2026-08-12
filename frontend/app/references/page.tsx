import type { Metadata } from "next";
import { STRINGS } from "@/lib/strings";
import { OG_IMAGE, SITE, SITE_URL } from "@/lib/site";
import ReferencesView from "./ReferencesView";

// A server wrapper that exists only to own this route's metadata. The view below is a
// client component and so cannot export any, which is why /references previously
// inherited the root <title> verbatim — two URLs, one identical title.
//
// Title and description are read from the SAME i18n strings the page renders (ref_title,
// ref_lede), not retyped here. A description that drifts from the page is worse than
// none, and hand-copying is how that drift starts.

const title = `${STRINGS.ref_title.id} — ${SITE.name}`;
const description = STRINGS.ref_lede.id;
const url = `${SITE_URL}/references/`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/references/" },
  openGraph: {
    type: "article",
    siteName: SITE.name,
    title,
    description,
    url,
    locale: SITE.locale,
    images: [OG_IMAGE],
  },
  twitter: { card: "summary", title, description, images: [OG_IMAGE.url] },
};

export default function ReferencesPage() {
  return <ReferencesView />;
}
