import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Orbitron } from "next/font/google";
import localFont from "next/font/local";
import { getRequestLocale, translate } from "@/i18n";

import "./globals.css";

const bodyFont = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const displayFont = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  display: "swap",
});

const monoFont = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const persianFont = localFont({
  src: [
    { path: "../../fonts/Vazir-Light.woff2", weight: "300", style: "normal" },
    { path: "../../fonts/Vazir.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/Vazir-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../fonts/Vazir-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-vazirmatn",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: {
      default: translate(locale, "metadata.title"),
      template: `%s · ${translate(locale, "metadata.title")}`,
    },
    description: translate(locale, "metadata.description"),
    applicationName: translate(locale, "metadata.title"),
    keywords: ["cooperative games", "two-player games", "gaming platform"],
  };
}

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#070912",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  return (
    <html
      lang={locale}
      dir={locale === "fa" ? "rtl" : "ltr"}
      data-locale={locale}
      className="dark"
      data-scroll-behavior="smooth"
    >
      <body
        className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable} ${persianFont.variable}`}
      >
        <a className="skip-link" href="#main-content">
          {translate(locale, "navigation.skipToContent")}
        </a>
        {children}
      </body>
    </html>
  );
}
