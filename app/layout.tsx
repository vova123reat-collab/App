import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jet = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-jet" });

export const metadata: Metadata = {
  title: "Real-Life RPG",
  description: "Тіло та навички як ігровий персонаж",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "RL-RPG" },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={jet.variable}>
      <body>{children}</body>
    </html>
  );
}
