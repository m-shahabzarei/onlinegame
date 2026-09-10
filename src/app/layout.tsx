import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Orbitron } from "next/font/google";
import { persianFont } from "@/i18n/font";
import { getRequestLocale, translate } from "@/i18n";
import { LocaleProvider } from "@/i18n/provider";
import { localeDirection } from "@/i18n/core";

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

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: {
      default: translate(locale, "metadata.title"),
      template: `%s · ${translate(locale, "metadata.title")}`,
    },
    description: translate(locale, "metadata.description"),
    applicationName: translate(locale, "metadata.title"),
    keywords: [
      translate(locale, "pages.cooperativeGames"),
      translate(locale, "pages.twoPlayerGames"),
      translate(locale, "pages.gamingPlatform"),
    ],
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
      dir={localeDirection[locale]}
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
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
