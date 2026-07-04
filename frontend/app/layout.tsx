import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Faraid Visualizer",
  description:
    "Islamic inheritance calculator that shows the reason for every share, with sources (KHI, Syafi'i).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
