import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme";
import MakerSignature from "@/components/MakerSignature";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "FaraidVisualizer — kalkulator waris Islam yang menjelaskan alasannya",
  description:
    "Islamic inheritance (faraid) calculator that shows the reason for every share, with cited sources (KHI, Syafi'i).",
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
