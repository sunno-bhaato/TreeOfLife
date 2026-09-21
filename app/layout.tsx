import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Mukta, Tiro_Devanagari_Hindi } from "next/font/google";
import "@xyflow/react/dist/style.css";
import "./globals.css";

const ui = Mukta({
  subsets: ["devanagari", "latin"],
  weight: ["400", "600"],
  variable: "--font-ui",
  display: "swap",
});

const display = Tiro_Devanagari_Hindi({
  subsets: ["devanagari", "latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "वंश वृक्ष",
  description: "हमारे परिवार का वंश वृक्ष",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hi" className={`${ui.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
