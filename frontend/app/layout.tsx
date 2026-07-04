import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Faraid Visualizer",
  description:
    "Kalkulator waris Islam yang menunjukkan alasan setiap bagian, dengan rujukan (KHI, Syafi'i).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
