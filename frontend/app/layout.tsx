import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme";
import MakerSignature from "@/components/MakerSignature";

// Only the weights the stylesheet actually references. Measured across globals.css:
// 600 (33 uses), 700 (26), 500 (5), plus 400 as the body default. 800 was declared and
// never used, so it was a font file downloaded and never painted.
const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// The serif is used only for display text — the wordmark, headings, fractions — at
// weights 500/600/700. `font-style: italic` appears zero times in globals.css, so the
// entire italic family was dead weight.
const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FaraidVisualizer — kalkulator waris Islam yang menjelaskan alasannya",
  description:
    "Islamic inheritance (faraid) calculator that shows the reason for every share, with cited sources (KHI, Syafi'i).",
  // Set by hand: Next prefixes basePath onto the icon links but NOT onto the manifest one,
  // which would emit href="/manifest.webmanifest" while the file is published under
  // /<repo>/ — a 404, and a manifest that 404s fails silently.
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/manifest.webmanifest`,
};

// Tints the browser/OS chrome around the page. Follows the theme so an installed window
// does not sit in a light bar above a dark page.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1e9" },
    { media: "(prefers-color-scheme: dark)", color: "#121310" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <I18nProvider>
            {children}
            {/* Shared footer — one seam for the whole site. The maker's mark sits on the
                right; a legal/data attribution, if one is ever added, belongs on the left
                of this same bar rather than in a second divided row. */}
            <footer className="site-footer">
              <div className="site-footer-inner">
                <MakerSignature />
              </div>
            </footer>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
